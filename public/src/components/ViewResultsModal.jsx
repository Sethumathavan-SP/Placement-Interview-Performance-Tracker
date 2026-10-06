function ViewResultsModal({ isOpen, onClose, drive }) {
    if (!isOpen || !drive) return null;

    const [results, setResults] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    const fetchResults = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/api/drives/${drive.id}/results`);
            const data = await res.json();
            if (res.ok && data.success) {
                setResults(data.results || []);
            }
        } catch (err) {
            console.error('Failed to fetch drive results:', err);
        } finally {
            setLoading(false);
        }
    }, [drive]);

    React.useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    const filtered = results.filter(r => 
        r.gmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.result.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-dialog large-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <div>
                        <h3>Candidate Results - {drive.company_name}</h3>
                        <p className="modal-sub">{drive.job_role} ({results.length} total updated candidates)</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="view-toolbar">
                    <div className="search-field" style={{ maxWidth: '300px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by gmail or status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span className="results-count-text">Showing {filtered.length} of {results.length} entries</span>
                </div>

                <div className="data-panel" style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '12px' }}>
                    {loading ? (
                        <div className="panel-loading">
                            <div className="spinner-sm"></div>
                            <span>Loading student evaluation results...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="panel-empty">
                            <h3>No Candidate Results Found</h3>
                            <p>Upload an Excel spreadsheet containing student Gmails to shortlist candidates for this drive.</p>
                        </div>
                    ) : (
                        <table className="enterprise-table">
                            <thead>
                                <tr>
                                    <th>Student Gmail</th>
                                    <th>Current Round</th>
                                    <th>Shortlist Status / Verdict</th>
                                    <th style={{ textAlign: 'right' }}>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => (
                                    <tr key={r.id}>
                                        <td className="font-semibold">{r.gmail}</td>
                                        <td>
                                            <span className="round-badge" style={{
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                color: '#818cf8',
                                                border: '1px solid rgba(99, 102, 241, 0.3)'
                                            }}>
                                                Round {r.round || 1}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="res-badge-pill">
                                                {r.result}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            {r.updated_at}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="modal-foot">
                    <button type="button" className="btn-cancel" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
