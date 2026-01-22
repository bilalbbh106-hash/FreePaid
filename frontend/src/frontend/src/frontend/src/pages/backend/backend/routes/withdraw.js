Enterconst express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// طلب سحب جديد
router.post('/request', async (req, res) => {
    try {
        const { userId, method, amount, details } = req.body;
        
        // التحقق من الرصيد
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();
            
        if (userError || user.balance < amount) {
            return res.status(400).json({ error: 'رصيد غير كافي' });
        }
        
        // إنشاء طلب السحب
        const withdrawalData = {
            user_id: userId,
            method: method,
            amount: amount,
            status: 'pending',
            details: details,
            request_id: `WTH${Date.now()}${crypto.randomInt(1000, 9999)}`
        };
        
        // حفظ في قاعدة البيانات
        const { data, error } = await supabase
            .from('withdrawal_requests')
            .insert([withdrawalData]);
            
        if (error) throw error;
        
        // خصم المبلغ من رصيد المستخدم
        await supabase
            .from('users')
            .update({ balance: user.balance - amount })
            .eq('id', userId);
            
        // إرسال طلب للبوت
        await sendToBot(withdrawalData);
        
        res.json({
            success: true,
            message: 'تم إرسال طلب السحب بنجاح',
            request_id: withdrawalData.request_id
        });
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'خطأ في معالجة السحب' });
    }
});

// الحصول على طلبات السحب للمستخدم
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { data, error } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إرسال طلب للبوت
async function sendToBot(withdrawalData) {
    try {
        const botUrl = process.env.BOT_WEBHOOK_URL;
        
        const response = await fetch(botUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'withdrawal_request',
                data: withdrawalData
            })
        });
        
        return response.ok;
    } catch (error) {
        console.error('Error sending to bot:', error);
        return false;
    }
}

module.exports = router;
