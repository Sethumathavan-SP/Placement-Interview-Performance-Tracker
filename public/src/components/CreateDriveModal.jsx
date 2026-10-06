function CreateDriveModal({ isOpen, onClose, onDriveCreated }) {
    if (!isOpen) return null;

    const [companyName, setCompanyName] = React.useState('');
    const [jobRole, setJobRole] = React.useState('');
    const [ctcLpa, setCtcLpa] = React.useState('');
    const [minCgpa, setMinCgpa] = React.useState('7.0');
    const [location, setLocation] = React.useState('Bangalore / Hybrid');
    const [deadline, setDeadline] = React.useState('2026-10-30');
    const [selectedBranches, setSelectedBranches] = React.useState(['CSE', 'IT', 'ECE', 'AIDS']);
    
    const [loading, setLoading] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState('');

    const availableBranches = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'];

    const toggleBranch = (branch) => {
        if (selectedBranches.includes(branch)) {
            setSelectedBranches(selectedBranches.filter(b => b !== branch));
        } else {
            setSelectedBranches([...selectedBranches, branch]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!companyName.trim()) {
            setErrorMsg('Please enter the Company Name.');
            return;
        }
        if (!jobRole.trim()) {
            setErrorMsg('Please enter the Job Role.');
            return;
        }
        if (!ctcLpa || isNaN(ctcLpa) || parseFloat(ctcLpa) <= 0) {
            setErrorMsg('Please enter a valid CTC package (LPA).');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                company_name: companyName.trim(),
                job_role: jobRole.trim(),
                ctc_lpa: parseFloat(ctcLpa),
                min_cgpa: parseFloat(minCgpa || 0),
                allowed_branches: selectedBranches.length > 0 ? selectedBranches.join(', ') : 'All Branches',
                location: location.trim() || 'On Campus',
                status: 'Active',
                deadline: deadline || null
            };

            const response = await authFetch('/api/drives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                onDriveCreated(data.drive);
                onClose();
            } else {
                setErrorMsg(data.message || 'Failed to create placement drive.');
            }
        } catch (err) {
            console.error('Error creating drive:', err);
            setErrorMsg('Server error. Could not connect to API.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <div>
                        <h3>Create Placement Drive</h3>
                        <p className="modal-sub">Publish a new recruitment drive for candidate enrollment</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose}>&times;</button>
                </div>

                {errorMsg && (
                    <div className="form-alert-error">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-row-2">
                        <div className="input-field">
                            <label>Company Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Google, Microsoft"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Job Designation *</label>
                            <input
                                type="text"
                                placeholder="e.g. Software Engineer"
                                value={jobRole}
                                onChange={(e) => setJobRole(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>CTC Package (LPA) *</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="e.g. 18.5"
                                value={ctcLpa}
                                onChange={(e) => setCtcLpa(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Minimum CGPA</label>
                            <input
                                type="number"
                                step="0.1"
                                max="10.0"
                                placeholder="e.g. 7.5"
                                value={minCgpa}
                                onChange={(e) => setMinCgpa(e.target.value)}
                            />
                        </div>

                        <div className="input-field">
                            <label>Job Location</label>
                            <input
                                type="text"
                                placeholder="e.g. Bangalore / Remote"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>

                        <div className="input-field">
                            <label>Registration Deadline</label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="input-field full">
                        <label>Eligible Branches</label>
                        <div className="branch-selector">
                            {availableBranches.map(branch => {
                                const isSelected = selectedBranches.includes(branch);
                                return (
                                    <button
                                        type="button"
                                        key={branch}
                                        className={`branch-chip ${isSelected ? 'active' : ''}`}
                                        onClick={() => toggleBranch(branch)}
                                    >
                                        {branch}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="modal-foot">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Publishing...' : 'Publish Drive'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
