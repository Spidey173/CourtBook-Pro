/**
 * Operations Command Center Controller — Manga Orange Edition
 */

let currentAdminTab = 'analytics';
let pricingRulesData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
});

function switchAdminTab(tab) {
    currentAdminTab = tab;
    const tabs = ['analytics', 'courts', 'coaches', 'equipment', 'pricing', 'bookings', 'users'];
    
    tabs.forEach(t => {
        const view = document.getElementById(`admin-view-${t}`);
        const btn = document.getElementById(`admin-tab-${t}`);
        if (t === tab) {
            if (view) view.style.display = 'block';
            if (btn) btn.className = 'admin-nav-item active';
        } else {
            if (view) view.style.display = 'none';
            if (btn) btn.className = 'admin-nav-item';
        }
    });

    if (tab === 'analytics') loadAnalytics();
    else if (tab === 'courts') loadAdminCourts();
    else if (tab === 'coaches') loadAdminCoaches();
    else if (tab === 'equipment') loadAdminEquipment();
    else if (tab === 'pricing') loadAdminPricingRules();
    else if (tab === 'bookings') loadAdminBookings();
    else if (tab === 'users') loadAdminUsers();
}

// ----------------------------------------------------
// 1. Analytics & KPIs
// ----------------------------------------------------
async function loadAnalytics() {
    try {
        const [stats, revenueReport] = await Promise.all([
            ApiClient.get('/api/admin/stats'),
            ApiClient.get('/api/admin/reports/revenue')
        ]);

        document.getElementById('stat-total-revenue').textContent = `₹${stats.totalRevenue || 0}`;
        document.getElementById('stat-total-bookings').textContent = stats.totalBookings || 0;
        document.getElementById('stat-today-bookings').textContent = stats.todayBookings || 0;
        document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;

        // Monthly trends
        const monthlyContainer = document.getElementById('monthly-revenue-container');
        if (revenueReport.revenueByMonth && revenueReport.revenueByMonth.length > 0) {
            monthlyContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${revenueReport.revenueByMonth.map(m => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                            <span style="font-weight: 700; color: var(--text-white);">${m.month}</span>
                            <span style="color: var(--text-muted); font-size: 0.85rem;">${m.bookings} bookings</span>
                            <span style="font-weight: 900; color: var(--orange-primary); font-family: var(--font-heading);">₹${m.revenue}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            monthlyContainer.innerHTML = '<p style="color: var(--text-muted);">No historical revenue records found.</p>';
        }

        // Top users
        const topUsersContainer = document.getElementById('top-users-container');
        if (revenueReport.topUsers && revenueReport.topUsers.length > 0) {
            topUsersContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${revenueReport.topUsers.map((u, i) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                            <div>
                                <span style="font-weight: 900; margin-right: 8px; color: var(--orange-primary);">#${i + 1}</span>
                                <span style="font-weight: 700; color: var(--text-white);">${u.username}</span>
                            </div>
                            <span style="color: var(--text-muted); font-size: 0.85rem;">${u.bookings} bookings</span>
                            <span style="font-weight: 900; color: var(--accent-green); font-family: var(--font-heading);">₹${u.totalSpent}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            topUsersContainer.innerHTML = '<p style="color: var(--text-muted);">No customer spending data available.</p>';
        }
    } catch (err) {
        ApiClient.showToast('Failed to load analytics data: ' + err.message, 'error');
    }
}

// ----------------------------------------------------
// 2. Courts Management
// ----------------------------------------------------
async function loadAdminCourts() {
    const container = document.getElementById('admin-courts-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading courts...</p>';

    try {
        const courts = await ApiClient.get('/api/admin/courts');
        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Court Name</th>
                            <th>Type</th>
                            <th>Base Rate</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courts.map(c => `
                            <tr>
                                <td style="font-weight: 800; color: var(--text-white);">${c.name}</td>
                                <td>
                                    <span class="badge-pro ${c.type === 'indoor' ? 'badge-indoor' : 'badge-outdoor'}">${c.type}</span>
                                </td>
                                <td style="font-weight: 800; color: var(--orange-primary); font-family: var(--font-heading);">₹${c.basePrice || c.base_price}/hr</td>
                                <td>
                                    <span class="badge-pro ${(c.isActive || c.is_active) ? 'badge-status-open' : 'badge-status-busy'}">
                                        ${(c.isActive || c.is_active) ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <button class="btn-manga btn-manga-secondary btn-manga-sm" onclick='openEditCourtModal(${JSON.stringify(c)})'>Edit</button>
                                    ${(c.isActive || c.is_active) ? `
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" onclick="deactivateCourt(${c.id})">Deactivate</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load courts: ${err.message}</p>`;
    }
}

function openAddCourtModal() {
    showAdminModal('Add New Arena Court', `
        <form onsubmit="submitAddCourt(event)">
            <div class="pro-form-group">
                <label class="pro-form-label">Court Name</label>
                <input type="text" id="courtName" class="pro-form-control" placeholder="e.g. Court 5 - Synthetic Pro" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Court Type</label>
                <select id="courtType" class="pro-form-control" required>
                    <option value="indoor">Indoor (Synthetic BWF Mat)</option>
                    <option value="outdoor">Outdoor (All-Weather Hardcourt)</option>
                </select>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Base Hourly Price (₹)</label>
                <input type="number" id="courtBasePrice" class="pro-form-control" placeholder="600" min="0" required>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Create Court</button>
        </form>
    `);
}

function openEditCourtModal(court) {
    showAdminModal(`Edit ${court.name}`, `
        <form onsubmit="submitEditCourt(event, ${court.id})">
            <div class="pro-form-group">
                <label class="pro-form-label">Court Name</label>
                <input type="text" id="editCourtName" class="pro-form-control" value="${court.name}" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Court Type</label>
                <select id="editCourtType" class="pro-form-control" required>
                    <option value="indoor" ${court.type === 'indoor' ? 'selected' : ''}>Indoor</option>
                    <option value="outdoor" ${court.type === 'outdoor' ? 'selected' : ''}>Outdoor</option>
                </select>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Base Hourly Price (₹)</label>
                <input type="number" id="editCourtBasePrice" class="pro-form-control" value="${court.basePrice || court.base_price}" min="0" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Active Status</label>
                <select id="editCourtActive" class="pro-form-control">
                    <option value="true" ${(court.isActive || court.is_active) ? 'selected' : ''}>Active</option>
                    <option value="false" ${!(court.isActive || court.is_active) ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Save Court Changes</button>
        </form>
    `);
}

async function submitAddCourt(e) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('courtName').value.trim(),
            type: document.getElementById('courtType').value,
            basePrice: parseInt(document.getElementById('courtBasePrice').value, 10),
            isActive: true
        };
        const res = await ApiClient.post('/api/admin/courts', payload);
        if (res.success) {
            ApiClient.showToast('Court added successfully', 'success');
            closeAdminModal();
            loadAdminCourts();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function submitEditCourt(e, courtId) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('editCourtName').value.trim(),
            type: document.getElementById('editCourtType').value,
            basePrice: parseInt(document.getElementById('editCourtBasePrice').value, 10),
            isActive: document.getElementById('editCourtActive').value === 'true'
        };
        const res = await ApiClient.put(`/api/admin/courts/${courtId}`, payload);
        if (res.success) {
            ApiClient.showToast('Court updated successfully', 'success');
            closeAdminModal();
            loadAdminCourts();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function deactivateCourt(courtId) {
    if (!confirm('Deactivate this court from the booking engine?')) return;
    try {
        await ApiClient.delete(`/api/admin/courts/${courtId}`);
        ApiClient.showToast('Court deactivated', 'info');
        loadAdminCourts();
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

// ----------------------------------------------------
// 3. Coaches Management
// ----------------------------------------------------
async function loadAdminCoaches() {
    const container = document.getElementById('admin-coaches-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading coaches...</p>';

    try {
        const coaches = await ApiClient.get('/api/admin/coaches');
        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Coach Name</th>
                            <th>Specialization</th>
                            <th>Hourly Fee</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${coaches.map(c => `
                            <tr>
                                <td style="font-weight: 800; color: var(--text-white);">${c.name}</td>
                                <td style="color: var(--text-muted);">${c.specialization || 'BWF Certified Coach'}</td>
                                <td style="font-weight: 800; color: var(--orange-primary); font-family: var(--font-heading);">₹${c.price}/hr</td>
                                <td>
                                    <span class="badge-pro ${(c.isActive || c.is_active) ? 'badge-status-open' : 'badge-status-busy'}">
                                        ${(c.isActive || c.is_active) ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <button class="btn-manga btn-manga-secondary btn-manga-sm" onclick='openEditCoachModal(${JSON.stringify(c)})'>Edit</button>
                                    ${(c.isActive || c.is_active) ? `
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" onclick="deactivateCoach(${c.id})">Deactivate</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load coaches: ${err.message}</p>`;
    }
}

function openAddCoachModal() {
    showAdminModal('Register Certified Coach', `
        <form onsubmit="submitAddCoach(event)">
            <div class="pro-form-group">
                <label class="pro-form-label">Coach Name</label>
                <input type="text" id="coachName" class="pro-form-control" placeholder="e.g. Coach Lin Dan" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Specialization</label>
                <input type="text" id="coachSpec" class="pro-form-control" placeholder="e.g. Advanced Footwork, Smash Power" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Hourly Fee (₹)</label>
                <input type="number" id="coachPrice" class="pro-form-control" placeholder="500" min="0" required>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Register Coach</button>
        </form>
    `);
}

function openEditCoachModal(coach) {
    showAdminModal(`Edit Coach ${coach.name}`, `
        <form onsubmit="submitEditCoach(event, ${coach.id})">
            <div class="pro-form-group">
                <label class="pro-form-label">Coach Name</label>
                <input type="text" id="editCoachName" class="pro-form-control" value="${coach.name}" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Specialization</label>
                <input type="text" id="editCoachSpec" class="pro-form-control" value="${coach.specialization || ''}" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Hourly Fee (₹)</label>
                <input type="number" id="editCoachPrice" class="pro-form-control" value="${coach.price}" min="0" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Active Status</label>
                <select id="editCoachActive" class="pro-form-control">
                    <option value="true" ${(coach.isActive || coach.is_active) ? 'selected' : ''}>Active</option>
                    <option value="false" ${!(coach.isActive || coach.is_active) ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Save Coach</button>
        </form>
    `);
}

async function submitAddCoach(e) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('coachName').value.trim(),
            specialization: document.getElementById('coachSpec').value.trim(),
            price: parseInt(document.getElementById('coachPrice').value, 10),
            isActive: true
        };
        const res = await ApiClient.post('/api/admin/coaches', payload);
        if (res.success) {
            ApiClient.showToast('Coach registered', 'success');
            closeAdminModal();
            loadAdminCoaches();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function submitEditCoach(e, coachId) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('editCoachName').value.trim(),
            specialization: document.getElementById('editCoachSpec').value.trim(),
            price: parseInt(document.getElementById('editCoachPrice').value, 10),
            isActive: document.getElementById('editCoachActive').value === 'true'
        };
        const res = await ApiClient.put(`/api/admin/coaches/${coachId}`, payload);
        if (res.success) {
            ApiClient.showToast('Coach updated', 'success');
            closeAdminModal();
            loadAdminCoaches();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function deactivateCoach(coachId) {
    if (!confirm('Deactivate this coach from booking selections?')) return;
    try {
        await ApiClient.delete(`/api/admin/coaches/${coachId}`);
        ApiClient.showToast('Coach deactivated', 'info');
        loadAdminCoaches();
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

// ----------------------------------------------------
// 4. Equipment Management
// ----------------------------------------------------
async function loadAdminEquipment() {
    const container = document.getElementById('admin-equipment-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading equipment...</p>';

    try {
        const items = await ApiClient.get('/api/admin/equipment');
        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Rental Price</th>
                            <th>Total Stock</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(eq => `
                            <tr>
                                <td style="font-weight: 800; color: var(--text-white);">${eq.name}</td>
                                <td style="font-weight: 800; color: var(--orange-primary); font-family: var(--font-heading);">₹${eq.price}</td>
                                <td style="font-weight: 700; color: var(--text-white);">${eq.totalAvailable || eq.total_available} units</td>
                                <td>
                                    <span class="badge-pro ${(eq.isActive || eq.is_active) ? 'badge-status-open' : 'badge-status-busy'}">
                                        ${(eq.isActive || eq.is_active) ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <button class="btn-manga btn-manga-secondary btn-manga-sm" onclick='openEditEquipmentModal(${JSON.stringify(eq)})'>Edit Stock</button>
                                    ${(eq.isActive || eq.is_active) ? `
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" onclick="deactivateEquipment(${eq.id})">Deactivate</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load equipment: ${err.message}</p>`;
    }
}

function openAddEquipmentModal() {
    showAdminModal('Add Equipment Inventory', `
        <form onsubmit="submitAddEquipment(event)">
            <div class="pro-form-group">
                <label class="pro-form-label">Item Name</label>
                <input type="text" id="eqName" class="pro-form-control" placeholder="e.g. Yonex Nanoflare 1000Z" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Rental Price (₹)</label>
                <input type="number" id="eqPrice" class="pro-form-control" placeholder="50" min="0" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Total Inventory Units</label>
                <input type="number" id="eqStock" class="pro-form-control" placeholder="10" min="0" required>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Add Item to Inventory</button>
        </form>
    `);
}

function openEditEquipmentModal(eq) {
    showAdminModal(`Edit ${eq.name}`, `
        <form onsubmit="submitEditEquipment(event, ${eq.id})">
            <div class="pro-form-group">
                <label class="pro-form-label">Item Name</label>
                <input type="text" id="editEqName" class="pro-form-control" value="${eq.name}" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Rental Price (₹)</label>
                <input type="number" id="editEqPrice" class="pro-form-control" value="${eq.price}" min="0" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Total Stock</label>
                <input type="number" id="editEqStock" class="pro-form-control" value="${eq.totalAvailable || eq.total_available}" min="0" required>
            </div>
            <div class="pro-form-group">
                <label class="pro-form-label">Active Status</label>
                <select id="editEqActive" class="pro-form-control">
                    <option value="true" ${(eq.isActive || eq.is_active) ? 'selected' : ''}>Active</option>
                    <option value="false" ${!(eq.isActive || eq.is_active) ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            <button type="submit" class="btn-manga btn-manga-primary" style="width: 100%; margin-top: 10px;">Save Stock</button>
        </form>
    `);
}

async function submitAddEquipment(e) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('eqName').value.trim(),
            price: parseInt(document.getElementById('eqPrice').value, 10),
            totalAvailable: parseInt(document.getElementById('eqStock').value, 10),
            isActive: true
        };
        const res = await ApiClient.post('/api/admin/equipment', payload);
        if (res.success) {
            ApiClient.showToast('Equipment added', 'success');
            closeAdminModal();
            loadAdminEquipment();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function submitEditEquipment(e, eqId) {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('editEqName').value.trim(),
            price: parseInt(document.getElementById('editEqPrice').value, 10),
            totalAvailable: parseInt(document.getElementById('editEqStock').value, 10),
            isActive: document.getElementById('editEqActive').value === 'true'
        };
        const res = await ApiClient.put(`/api/admin/equipment/${eqId}`, payload);
        if (res.success) {
            ApiClient.showToast('Equipment updated', 'success');
            closeAdminModal();
            loadAdminEquipment();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

async function deactivateEquipment(eqId) {
    if (!confirm('Deactivate this equipment item?')) return;
    try {
        await ApiClient.delete(`/api/admin/equipment/${eqId}`);
        ApiClient.showToast('Equipment deactivated', 'info');
        loadAdminEquipment();
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

// ----------------------------------------------------
// 5. Dynamic Pricing Rules
// ----------------------------------------------------
async function loadAdminPricingRules() {
    const container = document.getElementById('admin-pricing-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading pricing rules...</p>';

    try {
        pricingRulesData = await ApiClient.get('/api/admin/pricing-rules');
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${pricingRulesData.map(r => `
                    <div class="pro-card" style="padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.1rem; text-transform: capitalize; color: var(--text-white);">${r.rule_type.replace('_', ' ')}</div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">
                                ${r.rule_type === 'peak_hours' ? `Active: ${r.start_time || '18:00'} - ${r.end_time || '21:00'}` : ''}
                                ${r.rule_type === 'bundle' ? `Min equipment units: ${r.min_items || 3}` : ''}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            ${r.multiplier ? `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">Multiplier:</label>
                                    <input type="number" step="0.1" id="rule-mult-${r.rule_type}" class="pro-form-control" style="width: 80px; padding: 6px 10px;" value="${r.multiplier}">
                                </div>
                            ` : ''}
                            ${r.discount ? `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">Discount (0-1):</label>
                                    <input type="number" step="0.05" id="rule-disc-${r.rule_type}" class="pro-form-control" style="width: 80px; padding: 6px 10px;" value="${r.discount}">
                                </div>
                            ` : ''}
                            <label style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.9rem; color: var(--text-white); cursor: pointer;">
                                <input type="checkbox" id="rule-enable-${r.rule_type}" ${r.enabled ? 'checked' : ''}> Enabled
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load pricing rules: ${err.message}</p>`;
    }
}

async function savePricingRules() {
    try {
        const updatedRules = pricingRulesData.map(r => {
            const multInput = document.getElementById(`rule-mult-${r.rule_type}`);
            const discInput = document.getElementById(`rule-disc-${r.rule_type}`);
            const enableCheck = document.getElementById(`rule-enable-${r.rule_type}`);

            return {
                ruleType: r.rule_type,
                enabled: enableCheck ? enableCheck.checked : r.enabled,
                multiplier: multInput ? parseFloat(multInput.value) : r.multiplier,
                discount: discInput ? parseFloat(discInput.value) : r.discount,
                startTime: r.start_time,
                endTime: r.end_time,
                minItems: r.min_items,
                applyDays: r.apply_days
            };
        });

        const res = await ApiClient.put('/api/admin/pricing-rules', { rules: updatedRules });
        if (res.success) {
            ApiClient.showToast('Pricing rules updated successfully!', 'success');
            loadAdminPricingRules();
        }
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

// ----------------------------------------------------
// 6. Master Bookings
// ----------------------------------------------------
let bookingSearchTimeout = null;
function onBookingSearch() {
    clearTimeout(bookingSearchTimeout);
    bookingSearchTimeout = setTimeout(loadAdminBookings, 300);
}

async function loadAdminBookings() {
    const container = document.getElementById('admin-bookings-container');
    const search = document.getElementById('bookingSearch') ? document.getElementById('bookingSearch').value.trim() : '';
    const status = document.getElementById('bookingStatusFilter') ? document.getElementById('bookingStatusFilter').value : 'all';

    try {
        const data = await ApiClient.get(`/api/admin/bookings?search=${encodeURIComponent(search)}&status=${status}`);
        const bookings = data.bookings || [];

        if (bookings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No match bookings found.</p>';
            return;
        }

        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Match ID</th>
                            <th>Player</th>
                            <th>Court</th>
                            <th>Date & Time</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => `
                            <tr>
                                <td style="font-weight: 900; color: var(--orange-primary);">#${b.id}</td>
                                <td>
                                    <div style="font-weight: 800; color: var(--text-white);">${b.user ? b.user.username : 'Player #' + b.user_id}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-dim);">${b.user ? b.user.email : ''}</div>
                                </td>
                                <td style="font-weight: 700; color: var(--text-white);">${b.court ? b.court.name : 'Court #' + b.court_id}</td>
                                <td>${b.date} @ <strong style="color: var(--text-white);">${b.time_slot}</strong> (${b.duration}hr)</td>
                                <td style="font-weight: 900; color: var(--text-white); font-family: var(--font-heading); font-size: 1.05rem;">₹${b.total_price}</td>
                                <td>
                                    <span class="badge-pro ${b.status === 'confirmed' ? 'badge-status-open' : (b.status === 'completed' ? 'badge-admin-manga' : 'badge-status-busy')}">
                                        ${b.status === 'confirmed' ? '⚡ Confirmed' : (b.status === 'completed' ? '🏆 Completed' : '❌ Cancelled')}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    ${b.status === 'confirmed' ? `
                                        <button class="btn-manga btn-manga-primary btn-manga-sm" style="margin-right: 6px; padding: 6px 12px;" onclick="adminCompleteBooking(${b.id})">✅ Complete</button>
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" style="padding: 6px 12px;" onclick="adminCancelBooking(${b.id})">Cancel</button>
                                    ` : (b.status === 'completed' ? '<span style="color: var(--accent-green); font-size: 0.85rem; font-weight: 700;">Match Finished</span>' : '<span style="color: var(--text-dim); font-size: 0.85rem;">Released</span>')}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load bookings: ${err.message}</p>`;
    }
}

async function adminCompleteBooking(bookingId) {
    if (!confirm(`Mark Match Booking #${bookingId} as Completed?`)) return;
    try {
        await ApiClient.post(`/api/admin/bookings/${bookingId}/complete`);
        ApiClient.showToast(`Booking #${bookingId} marked as Completed 🏆`, 'success');
        loadAdminBookings();
    } catch (err) {
        ApiClient.showToast(err.message || 'Failed to complete booking', 'error');
    }
}

async function adminCancelBooking(bookingId) {
    if (!confirm(`Cancel Match Booking #${bookingId}? Slot locks will be immediately released.`)) return;
    try {
        await ApiClient.post(`/api/admin/bookings/${bookingId}/cancel`);
        ApiClient.showToast(`Booking #${bookingId} cancelled`, 'info');
        loadAdminBookings();
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}


// ----------------------------------------------------
// 7. Users Management
// ----------------------------------------------------
let userSearchTimeout = null;
function onUserSearch() {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(loadAdminUsers, 300);
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users-container');
    const search = document.getElementById('userSearch') ? document.getElementById('userSearch').value.trim() : '';

    try {
        const data = await ApiClient.get(`/api/admin/users?search=${encodeURIComponent(search)}`);
        const users = data.users || [];

        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Player Handle</th>
                            <th>Email Address</th>
                            <th>Role</th>
                            <th>Total Bookings</th>
                            <th>Registered</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td style="font-weight: 800; color: var(--text-white);">${u.username}</td>
                                <td style="color: var(--text-muted);">${u.email}</td>
                                <td>
                                    <span class="badge-pro ${u.isAdmin ? 'badge-admin-manga' : 'badge-member-manga'}">
                                        ${u.isAdmin ? 'Pro Admin' : 'Player Member'}
                                    </span>
                                </td>
                                <td style="font-weight: 800; color: var(--text-white);">${u.totalBookings || 0} matches</td>
                                <td style="color: var(--text-dim); font-size: 0.85rem;">${u.createdAt}</td>
                                <td style="text-align: right;">
                                    <button class="btn-manga btn-manga-secondary btn-manga-sm" onclick="toggleUserAdmin(${u.id}, ${!u.isAdmin})">
                                        ${u.isAdmin ? 'Revoke Admin' : 'Promote to Admin'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load users: ${err.message}</p>`;
    }
}

async function toggleUserAdmin(userId, makeAdmin) {
    if (!confirm(`Are you sure you want to ${makeAdmin ? 'promote this player to Pro Admin' : 'revoke Pro Admin access'}?`)) return;
    try {
        await ApiClient.put(`/api/admin/users/${userId}`, { isAdmin: makeAdmin });
        ApiClient.showToast('User role updated', 'success');
        loadAdminUsers();
    } catch (err) {
        ApiClient.showToast(err.message, 'error');
    }
}

// ----------------------------------------------------
// Modal Helpers
// ----------------------------------------------------
function showAdminModal(title, contentHtml) {
    const modal = document.getElementById('admin-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = contentHtml;
    modal.style.display = 'flex';
}

function closeAdminModal() {
    const modal = document.getElementById('admin-modal');
    modal.style.display = 'none';
}
