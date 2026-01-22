Enterconst { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const axios = require('axios');

class AutoWithdrawalBot {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        this.isRunning = false;
        this.processingQueue = [];
    }
    
    async start() {
        this.isRunning = true;
        console.log('🤖 روبوت السحب الآلي يعمل...');
        
        // تشغيل معالجة الطلبات كل 30 ثانية
        setInterval(() => this.processQueue(), 30000);
        
        // معالجة الطلبات المعلقة عند التشغيل
        await this.processPendingRequests();
    }
    
    async processPendingRequests() {
        try {
            const { data: pendingRequests, error } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('status', 'pending');
                
            if (error) throw error;
            
            for (const request of pendingRequests) {
                await this.processWithdrawal(request);
            }
        } catch (error) {
            console.error('Error processing pending requests:', error);
        }
    }
    
    async processWithdrawal(request) {
        try {
            console.log(`🔧 معالجة طلب السحب: ${request.request_id}`);
            
            // التحقق الأمني
            const securityCheck = await this.securityChecks(request.user_id);
            if (!securityCheck.passed) {
                await this.updateRequestStatus(request.id, 'failed', securityCheck.reason);
                return;
            }
            
            // معالجة حسب طريقة السحب
            let result;
            switch (request.method) {
                case 'visa':
                    result = await this.processVisaCard(request);
                    break;
                case 'freefire':
                    result = await this.processFreeFireCode(request);
                    break;
                case 'fawry':
                    result = await this.processFawry(request);
                    break;
                case 'paypal':
                    result = { success: false, message: 'بايبال قيد الصيانة حالياً' };
                    break;
                default:
                    result = { success: false, message: 'طريقة سحب غير معروفة' };
            }
            
            // تحديث حالة الطلب
            if (result.success) {
                await this.updateRequestStatus(request.id, 'completed', result.message);
                
                // إرسال الإيميل
                await this.sendWithdrawalEmail(request, result.details);
            } else {
                await this.updateRequestStatus(request.id, 'failed', result.message);
            }
            
        } catch (error) {
            console.error('Error processing withdrawal:', error);
            await this.updateRequestStatus(request.id, 'failed', 'خطأ في المعالجة');
        }
    }
    
    async securityChecks(userId) {
        const checks = {
            ip_check: await this.checkIP(userId),
            device_check: await this.checkDevice(userId),
            withdrawal_limit: await this.checkDailyLimit(userId),
            suspicious_activity: await this.checkSuspiciousActivity(userId)
        };
        
        for (const [check, result] of Object.entries(checks)) {
            if (!result.passed) {
                return result;
            }
        }
        
        return { passed: true };
    }
    
    async checkIP(userId) {
        // التحقق من IP المستخدم
        const { data: userSessions, error } = await this.supabase
            .from('user_sessions')
            .select('ip_address')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) return { passed: false, reason: 'خطأ في التحقق من IP' };
        
        // التحقق من تعدد IPs
        const uniqueIPs = new Set(userSessions.map(s => s.ip_address));
        if (uniqueIPs.size > 3) {
            return { passed: false, reason: 'تعدد عناوين IP مشبوه' };
        }
        
        return { passed: true };
    }
    
    async processVisaCard(request) {
        try {
            // جلب بطاقة متاحة
            const { data: availableCards, error } = await this.supabase
                .from('prepaid_cards')
                .select('*')
                .eq('status', 'active')
                .eq('amount', request.amount)
                .limit(1);
                
            if (error || !availableCards.length) {
                return { success: false, message: 'لا توجد بطاقات متاحة حالياً' };
            }
            
            const card = availableCards[0];
            
            // تحديث حالة البطاقة
            await this.supabase
                .from('prepaid_cards')
                .update({
                    status: 'used',
                    user_id: request.user_id,
                    used_at: new Date()
                })
                .eq('id', card.id);
                
            return {
                success: true,
                message: 'تم إرسال بطاقة الفيزا إلى بريدك الإلكتروني',
                details: {
                    card_number: card.card_number,
                    expiry_date: card.expiry_date,
                    cvv: card.cvv,
                    amount: card.amount,
                    country: card.country
                }
            };
            
        } catch (error) {
            console.error('Error processing visa card:', error);
            return { success: false, message: 'خطأ في معالجة البطاقة' };
        }
    }
    
    async processFreeFireCode(request) {
        try {
            // جلب كود متاح
            const { data: availableCodes, error } = await this.supabase
                .from('freefire_codes')
                .select('*')
                .eq('status', 'active')
                .gte('gems_amount', request.amount * 110) // تحويل الدولار إلى جواهر
                .limit(1);
                
            if (error || !availableCodes.length) {
                return { success: false, message: 'لا توجد أكواد متاحة حالياً' };
            }
            
            const code = availableCodes[0];
            
            // تحديث حالة الكود
            await this.supabase
                .from('freefire_codes')
                .update({
                    times_used: code.times_used + 1,
                    status: code.times_used + 1 >= code.max_uses ? 'used' : 'active',
                    user_id: request.user_id
                })
                .eq('id', code.id);
                
            return {
                success: true,
                message: 'تم إرسال كود فري فاير إلى بريدك الإلكتروني',
                details: {
                    code: await this.decryptCode(code.code_hash),
                    gems: code.gems_amount,
                    region: code.region,
                    expiry_date: code.expiration_date
                }
            };
            
        } catch (error) {
            console.error('Error processing freefire code:', error);
            return { success: false, message: 'خطأ في معالجة الكود' };
        }
    }
    
    async processFawry(request) {
        try {
            // API فوست باي
            const fawryResponse = await axios.post('https://atfawry.com/api/payments/process', {
                merchantCode: process.env.FAWRY_MERCHANT_CODE,
                merchantRefNum: request.request_id,
                customerMobile: request.details.phone,
                amount: request.amount,
                paymentMethod: 'CASH'
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.FAWRY_API_KEY}`
                }
            });
            
            if (fawryResponse.data.status === 'SUCCESS') {
                return {
                    success: true,
                    message: 'تمت معالجة السحب عبر فوست باي',
                    details: {
                        reference: fawryResponse.data.referenceNumber,
                        amount: request.amount
                    }
                };
            } else {
                return { success: false, message: 'فشل في معالجة السحب عبر فوست باي' };
            }
            
        } catch (error) {
            console.error('Fawry processing error:', error);
            return { success: false, message: 'خطأ في اتصال فوست باي' };
        }
    }
    
    async sendWithdrawalEmail(request, details) {
        try {
            // جلب إيميل المستخدم
            const { data: user, error } = await this.supabase
                .from('users')
                .select('email')
                .eq('id', request.user_id)
                .single();
                
            if (error) return;
            
            // إنشاء محتوى الإيميل
            let subject, html;
            if (request.method === 'visa') {
                subject = '💰 تفاصيل بطاقة الفيزا الخاصة بك - FreePaid';
                html = this.createVisaEmail(details);
            } else if (request.method === 'freefire') {
                subject = '🎮 كود جواهر فري فاير الخاص بك - FreePaid';
                html = this.createFreeFireEmail(details);
            } else if (request.method === 'fawry') {
                subject = '✅ تأكيد سحب فوست باي - FreePaid';
                html = this.createFawryEmail(details);
            }
            
            // إرسال الإيميل
            await this.emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: subject,
                html: html
            });
            
            console.log(`📧 تم إرسال إيميل إلى ${user.email}`);
            
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }
    
    createVisaEmail(details) {
        return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; }
                .card-details { background: #f8f9fa; padding: 20px; border-radius: 10px; }
                .warning { color: #dc3545; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>🎉 مبروك! تم سحب رصيدك بنجاح</h2>
            <div class="card-details">
                <p><strong>رقم البطاقة:</strong> ${details.card_number}</p>
                <p><strong>تاريخ الانتهاء:</strong> ${details.expiry_date}</p>
                <p><strong>CVV:</strong> ${details.cvv}</p>
                <p><strong>القيمة:</strong> $${details.amount}</p>
                <p><strong>البلد:</strong> ${details.country}</p>
            </div>
            <p class="warning">⚠️ هذه معلومات حساسة، لا تشاركها مع أحد</p>
        </body>
        </html>
        `;
    }
    
    async decryptCode(encryptedCode) {
        // فك تشفير الكود
        const crypto = require('crypto');
        const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedCode, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

module.exports = AutoWithdrawalBot;
