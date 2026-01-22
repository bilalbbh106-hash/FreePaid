import React, { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import StatsCard from '../components/StatsCard';
import TaskItem from '../components/TaskItem';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = ({ user, balance }) => {
    const [stats, setStats] = useState({
        totalEarned: 0,
        tasksCompleted: 0,
        videosWatched: 0,
        referrals: 0
    });
    
    const [recentTasks, setRecentTasks] = useState([]);
    const [chartData, setChartData] = useState({});

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            setStats(data.stats);
            setRecentTasks(data.recentTasks);
            
            // بيانات الرسوم البيانية
            setChartData({
                labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
                datasets: [{
                    label: 'الأرباح اليومية',
                    data: [12, 19, 8, 15, 22, 18, 25],
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    };

    return (
        <div className="dashboard">
            <div className="container-fluid">
                {/* الترحيب */}
                <div className="welcome-section mb-4">
                    <div className="row align-items-center">
                        <div className="col-md-6">
                            <h1 className="display-5 fw-bold">
                                مرحباً، <span className="text-gradient">{user?.name}</span>! 👋
                            </h1>
                            <p className="lead">ابدأ رحلتك نحو الربح من الإنترنت</p>
                        </div>
                        <div className="col-md-6 text-end">
                            <div className="balance-card glass-card p-4 d-inline-block">
                                <h6 className="text-muted">رصيدك الحالي</h6>
                                <h2 className="fw-bold text-success">
                                    ${balance.toFixed(2)}
                                    <i className="fas fa-coins ms-2 coin-animation"></i>
                                </h2>
                                <button className="btn btn-gradient btn-sm mt-2 pulse">
                                    <i className="fas fa-bolt me-2"></i>
                                    ابدأ الربح الآن
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* إحصائيات */}
                <div className="row g-4 mb-4">
                    <div className="col-xl-3 col-md-6">
                        <StatsCard
                            title="إجمالي الأرباح"
                            value={`$${stats.totalEarned}`}
                            icon="fas fa-money-bill-wave"
                            color="success"
                            progress={75}
                        />
                    </div>
                    <div className="col-xl-3 col-md-6">
                        <StatsCard
                            title="المهام المكتملة"
                            value={stats.tasksCompleted}
                            icon="fas fa-tasks"
                            color="primary"
                            progress={60}
                        />
                    </div>
                    <div className="col-xl-3 col-md-6">
                        <StatsCard
                            title="الفيديوهات المشاهدة"
                            value={stats.videosWatched}
                            icon="fas fa-play-circle"
                            color="warning"
                            progress={85}
                        />
                    </div>
                    <div className="col-xl-3 col-md-6">
                        <StatsCard
                            title="الأحالة"
                            value={stats.referrals}
                            icon="fas fa-users"
                            color="info"
                            progress={45}
                        />
                    </div>
                </div>

                {/* الرسوم البيانية والمهام */}
                <div className="row g-4">
                    <div className="col-lg-8">
                        <div className="glass-card p-4 h-100">
                            <h4 className="mb-4">📈 إحصائيات الأرباح</h4>
                            <Line data={chartData} options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        rtl: true
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true
                                    }
                                }
                            }} />
                        </div>
                    </div>
                    
                    <div className="col-lg-4">
                        <div className="glass-card p-4 h-100">
                            <h4 className="mb-4">⚡ مهام سريعة</h4>
                            <div className="quick-tasks">
                                {recentTasks.slice(0, 3).map((task, index) => (
                                    <TaskItem key={index} task={task} />
                                ))}
                                <button className="btn btn-outline-primary w-100 mt-3">
                                    <i className="fas fa-plus me-2"></i>
                                    عرض جميع المهام
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* إعلانات مميزة */}
                <div className="row mt-4">
                    <div className="col-12">
                        <div className="glass-card p-4">
                            <div className="row align-items-center">
                                <div className="col-md-8">
                                    <h4>🎁 عرض خاص للمستخدمين الجدد!</h4>
                                    <p className="mb-0">احصل على 1$ هدية فور التسجيل وإكمال أول مهمة</p>
                                </div>
                                <div className="col-md-4 text-end">
                                    <button className="btn btn-gradient btn-lg">
                                        <i className="fas fa-gift me-2"></i>
                                        احصل على الهدية الآن
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
