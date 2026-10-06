window.authFetch = async (url, options = {}) => {
    const csrfToken = localStorage.getItem('csrf_token') || '';

    const config = {
        ...options,
        credentials: 'include',
        headers: {
            ...options.headers,
            'X-CSRF-Token': csrfToken,
        },
    };

    let response = await fetch(url, config);

    if (response.status === 401) {
        const refreshResponse = await fetch('/api/refresh', {
            method: 'POST',
            credentials: 'include',
        });

        if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.csrf_token) {
                localStorage.setItem('csrf_token', refreshData.csrf_token);
                config.headers['X-CSRF-Token'] = refreshData.csrf_token;
            }
            response = await fetch(url, config);
        } else {
            localStorage.removeItem('csrf_token');
            window.location.reload();
            return response;
        }
    }

    return response;
};

function App() {
    const [currentUser, setCurrentUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch('/api/me', {
            credentials: 'include',
            headers: { 'X-CSRF-Token': localStorage.getItem('csrf_token') || '' },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => setCurrentUser(data.user))
            .catch(() => setCurrentUser(null))
            .finally(() => setLoading(false));
    }, []);

    const handleLogout = async () => {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': localStorage.getItem('csrf_token') || '' },
        });
        localStorage.removeItem('csrf_token');
        setCurrentUser(null);
    };

    if (loading) {
        return (
            <div className="app-viewport" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <svg className="spinner" viewBox="0 0 50 50" style={{ width: 40, height: 40 }}>
                        <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5" stroke="#6366f1"></circle>
                    </svg>
                    <p>Verifying session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-viewport">
            <main className="main-content">
                {currentUser ? (
                    <Dashboard user={currentUser} onLogout={handleLogout} />
                ) : (
                    <LoginForm onLoginSuccess={(user) => setCurrentUser(user)} />
                )}
            </main>
        </div>
    );
}
