import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Withdraw from './pages/Withdraw';
import WatchVideos from './pages/WatchVideos';
import Referrals from './pages/Referrals';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import './styles/App.css';

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0.00);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        // تحقق من وجود مستخدم مسجل
        const savedUser = localStorage.getItem('freepaid_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        
        // تحميل الرصيد
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        // API call لتحميل الرصيد
        try {
            const response = await fetch('/api/user/balance');
            const data = await response.json();
            setBalance(data.balance);
        } catch (error) {
            console.error('Error fetching balance:', error);
        }
    };

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('freepaid_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('freepaid_user');
    };

    return (
        <Router>
            <div className="app-container">
                {user && <Navbar user={user} balance={balance} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}
                {user && <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />}
                
                <div className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
                    <Routes>
                        <Route path="/login" element={<Login onLogin={handleLogin} />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/" element={user ? <Dashboard user={user} balance={balance} /> : <Login onLogin={handleLogin} />} />
                        <Route path="/tasks" element={user ? <Tasks user={user} /> : <Login onLogin={handleLogin} />} />
                        <Route path="/watch" element={user ? <WatchVideos user={user} /> : <Login onLogin={handleLogin} />} />
                        <Route path="/withdraw" element={user ? <Withdraw user={user} balance={balance} /> : <Login onLogin={handleLogin} />} />
                        <Route path="/referrals" element={user ? <Referrals user={user} /> : <Login onLogin={handleLogin} />} />
                        <Route path="/admin" element={user && user.role === 'admin' ? <Admin user={user} /> : <Dashboard user={user} balance={balance} />} />
                    </Routes>
                </div>
                
                {/* إشعارات */}
                <div className="notifications-container" id="notifications"></div>
            </div>
        </Router>
    );
}

export default App;
