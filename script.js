// 실손계산기 Pro Logic (Final Version with Enhanced Summary)

// --- Constants & Config ---
const GENERATION_CONFIG = {
    'gen1': {
        name: '1세대',
        desc: '입원 100% / 통원 100% (공제 5천원)',
        limitInfo: '통원 1회당 10만원 한도',
        calc: (pay, nonPay, treatmentType, facility) => {
            const total = pay + nonPay;
            if (treatmentType === 'inpatient') {
                return total;
            } else {
                const deductible = 5000;
                let refund = 0;
                if (total > deductible) refund = total - deductible;
                return Math.min(refund, 100000);
            }
        }
    },
    'gen2': {
        name: '2세대',
        desc: '급여 90% / 비급여 90% (또는 80%)',
        limitInfo: '통원 25만원 / 약국 5만원',
        calc: (pay, nonPay, treatmentType, facility) => {
            const total = pay + nonPay;
            let refund = 0;
            if (treatmentType === 'inpatient') {
                refund = Math.floor(total * 0.9);
                return refund;
            } else {
                let deductible = 10000;
                if (facility === 'hospital') deductible = 15000;
                if (facility === 'general' || facility === 'tertiary') deductible = 20000;
                if (facility === 'pharmacy') deductible = 8000;

                if (total > deductible) refund = total - deductible;

                if (facility === 'pharmacy') return Math.min(refund, 50000);
                else return Math.min(refund, 250000);
            }
        }
    },
    'gen3': {
        name: '3세대',
        desc: '급여 90% / 비급여 80%',
        limitInfo: '통원 25만원 / 약국 5만원',
        calc: (pay, nonPay, treatmentType, facility) => {
            if (treatmentType === 'inpatient') {
                return Math.floor(pay * 0.9 + nonPay * 0.8);
            } else {
                let minDeductible = 10000;
                if (facility === 'hospital') minDeductible = 15000;
                if (facility === 'general' || facility === 'tertiary') minDeductible = 20000;
                if (facility === 'pharmacy') minDeductible = 8000;

                const logicDeductible = (pay * 0.1) + (nonPay * 0.2);
                const finalDeductible = Math.max(minDeductible, logicDeductible);

                const total = pay + nonPay;
                let refund = 0;
                if (total > finalDeductible) refund = Math.floor(total - finalDeductible);

                if (facility === 'pharmacy') return Math.min(refund, 50000);
                else return Math.min(refund, 250000);
            }
        }
    },
    'gen4': {
        name: '4세대',
        desc: '급여 80% / 비급여 70%',
        limitInfo: '통원 25만원 / 약국 5만원',
        calc: (pay, nonPay, treatmentType, facility) => {
            if (treatmentType === 'inpatient') {
                return Math.floor(pay * 0.8 + nonPay * 0.7);
            } else {
                let payBaseDeductible = 10000;
                if (facility === 'general' || facility === 'tertiary') payBaseDeductible = 20000;
                if (facility === 'pharmacy') payBaseDeductible = 5000;

                const payRefund = Math.max(0, pay - Math.max(payBaseDeductible, pay * 0.2));
                const nonPayRefund = Math.max(0, nonPay - Math.max(30000, nonPay * 0.3));

                const totalRefund = Math.floor(payRefund + nonPayRefund);

                if (facility === 'pharmacy') return Math.min(totalRefund, 50000);
                else return Math.min(totalRefund, 250000);
            }
        }
    }
};

// --- DOM Elements ---
const receiptsContainer = document.getElementById('receiptsContainer');
const addReceiptBtn = document.getElementById('addReceiptBtn');
const calculateBtn = document.getElementById('calculateBtn');
const resetBtn = document.getElementById('resetBtn');
const resultContainer = document.getElementById('resultContainer');
const resultGrid = document.getElementById('resultGrid');

// Summary table elements
const summarySection = document.getElementById('summarySection');
const summaryBody = document.getElementById('summaryBody');

// Excel handling
const excelUpload = document.getElementById('excelUpload');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const downloadResultBtn = document.getElementById('downloadResultBtn');


// State
let receiptCount = 0;
let uniqueIdCounter = 0;


// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    addReceipt();

    // Event Listeners (Safe Attachment)
    const excelUpload = document.getElementById('excelUpload');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const downloadResultBtn = document.getElementById('downloadResultBtn');

    if (excelUpload) excelUpload.addEventListener('change', handleExcelUpload);
    if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', handleTemplateDownload);
    if (downloadResultBtn) downloadResultBtn.addEventListener('click', handleExcelDownload);
});

// Actions
addReceiptBtn.addEventListener('click', () => addReceipt());
resetBtn.addEventListener('click', resetAll);


// --- Functions ---
// --- Functions ---
function addReceipt(data = null) {
    receiptCount++;
    uniqueIdCounter++; // Always increment unique counter
    const currentId = uniqueIdCounter; // Capture for closure safety

    const template = document.getElementById('receiptTemplate');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.receipt-card');

    // Use unique ID for technical attributes to strictly avoid collision
    card.dataset.id = currentId;
    // Visual count uses logic sequence
    clone.querySelector('.count').textContent = receiptCount;

    // Check Error Flag from Excel
    if (data && data.isError) {
        card.dataset.error = "true";
    }

    // Inputs
    const dateInput = clone.querySelector('.receipt-date');
    const facilitySelect = clone.querySelector('.facility-select');
    const diseaseCode = clone.querySelector('.disease-code');

    // Type Inputs (Radios) - Use UNIQUE ID for grouping
    const typeRadios = clone.querySelectorAll('.type-input');
    typeRadios.forEach(radio => {
        radio.name = `type_${currentId}`;
        // Clean default checked state to avoid ambiguity
        radio.removeAttribute('checked');
        radio.checked = false;

        // Default to Outpatient if no data
        if (!data && radio.value === 'outpatient') {
            radio.checked = true;
        }

        radio.addEventListener('change', updateSummary);
    });

    // Cost Inputs (5 Fields)
    const iPaySelf = clone.querySelector('.cost-pay-self');
    const iPayNHIS = clone.querySelector('.cost-pay-nhis');
    const iPayFull = clone.querySelector('.cost-pay-full');
    const iNonPaySelect = clone.querySelector('.cost-nonpay-select');
    const iNonPayOther = clone.querySelector('.cost-nonpay-other');

    if (data) {
        if (data.date) dateInput.value = data.date;
        if (data.facility) facilitySelect.value = data.facility;
        if (data.code) diseaseCode.value = data.code;

        if (data.paySelf) iPaySelf.value = data.paySelf.toLocaleString();
        if (data.payNHIS) iPayNHIS.value = data.payNHIS.toLocaleString();
        if (data.payFull) iPayFull.value = data.payFull.toLocaleString();
        if (data.nonPaySelect) iNonPaySelect.value = data.nonPaySelect.toLocaleString();
        if (data.nonPayOther) iNonPayOther.value = data.nonPayOther.toLocaleString();
    } else {
        dateInput.valueAsDate = new Date();
    }

    clone.querySelector('.delete-btn').addEventListener('click', () => {
        card.remove();
        updateReceiptNumbers();
        updateSummary();
    });

    const allInputs = [iPaySelf, iPayNHIS, iPayFull, iNonPaySelect, iNonPayOther, diseaseCode];
    allInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            if (input !== diseaseCode) {
                let val = e.target.value.replace(/[^\d]/g, '');
                if (val) e.target.value = parseInt(val).toLocaleString('ko-KR');
                else e.target.value = '';
            }
            updateSummary();
        });
    });

    dateInput.addEventListener('change', updateSummary);
    facilitySelect.addEventListener('change', updateSummary);

    // Append first to ensure DOM presence
    receiptsContainer.appendChild(clone);

    // Set Radio State (Delayed and Closure-Safe)
    if (data && data.type) {
        setTimeout(() => {
            // Query live element using captured unique ID (closure safe)
            const radios = document.getElementsByName(`type_${currentId}`);
            radios.forEach(r => {
                if (r.value === data.type) r.checked = true;
                else r.checked = false;
            });
            updateSummary(); // Re-calc summary after change
        }, 0);
    } else {
        updateSummary();
    }


    updateSummary();
}

function updateReceiptNumbers() {
    const cards = document.querySelectorAll('.receipt-card');

    cards.forEach((card, index) => {
        card.querySelector('.count').textContent = index + 1;
    });
    receiptCount = cards.length;
}

function resetAll() {
    if (!confirm("모든 데이터를 초기화하시겠습니까?")) return;
    receiptsContainer.innerHTML = '';
    receiptCount = 0;
    addReceipt();
    resultContainer.classList.remove('show');
    resultContainer.style.display = 'none';
    updateSummary();
}

function updateSummary() {
    const cards = document.querySelectorAll('.receipt-card');
    const treatmentTypeRadio = document.querySelector('input[name="treatmentType"]:checked');
    const treatmentType = treatmentTypeRadio ? treatmentTypeRadio.value : 'outpatient';

    let totalPaySelf = 0, totalPayNHIS = 0, totalPayFull = 0, totalNonPaySelect = 0, totalNonPayOther = 0;

    // Grand Totals for calc columns
    let grandCalcGen1 = 0, grandCalcGen2 = 0, grandCalcGen3 = 0, grandCalcGen4 = 0;

    summaryBody.innerHTML = '';

    if (cards.length > 0) summarySection.style.display = 'block';
    else { summarySection.style.display = 'none'; return; }

    cards.forEach((card, index) => {
        const paySelf = getVal(card.querySelector('.cost-pay-self'));
        const payNHIS = getVal(card.querySelector('.cost-pay-nhis'));
        const payFull = getVal(card.querySelector('.cost-pay-full'));
        const nonPaySelect = getVal(card.querySelector('.cost-nonpay-select'));
        const nonPayOther = getVal(card.querySelector('.cost-nonpay-other'));

        // Correctly identify treatment type per card
        const radioIn = card.querySelector('.type-input[value="inpatient"]');
        const treatmentType = (radioIn && radioIn.checked) ? 'inpatient' : 'outpatient';

        const currentTotalCost = paySelf + payNHIS + payFull + nonPaySelect + nonPayOther;

        const payBase = paySelf + payFull;
        const nonPayBase = nonPaySelect + nonPayOther;

        totalPaySelf += paySelf;
        totalPayNHIS += payNHIS;
        totalPayFull += payFull;
        totalNonPaySelect += nonPaySelect;
        totalNonPayOther += nonPayOther;

        const date = card.querySelector('.receipt-date').value || '-';
        const facilitySelect = card.querySelector('.facility-select');
        const facilityText = facilitySelect.options[facilitySelect.selectedIndex].text;
        const facility = facilitySelect.value;
        const code = card.querySelector('.disease-code').value || '-';
        const codeDisplay = code !== '-' ? `<span style="color:#ef4444; font-weight:700;">${code}</span>` : '<span style="color:#cbd5e1;">-</span>';

        // Row Calc
        const calc1 = GENERATION_CONFIG['gen1'].calc(payBase, nonPayBase, treatmentType, facility);
        const calc2 = GENERATION_CONFIG['gen2'].calc(payBase, nonPayBase, treatmentType, facility);
        const calc3 = GENERATION_CONFIG['gen3'].calc(payBase, nonPayBase, treatmentType, facility);
        const calc4 = GENERATION_CONFIG['gen4'].calc(payBase, nonPayBase, treatmentType, facility);

        grandCalcGen1 += calc1;
        grandCalcGen2 += calc2;
        grandCalcGen3 += calc3;
        grandCalcGen4 += calc4;

        const typeLabel = treatmentType === 'outpatient' ? '통원' : '입원';

        // Error Styling
        let rowStyle = '';
        let displayTypeLabel = typeLabel;
        if (card.dataset.error === "true") {
            displayTypeLabel += ' (오타)';
            rowStyle = 'background-color: #e5e7eb; color: #9ca3af;';
        }

        // Highlight Helper
        const formatCalc = (val) => {
            if (val === 0 && (payBase + nonPayBase) > 0) return `<span class="zero-pay">0</span>`;
            return `<span style="color:var(--brand-primary); font-weight:600;">${val.toLocaleString()}</span>`;
        };

        const tr = document.createElement('tr');
        if (rowStyle) tr.style.cssText = rowStyle;

        tr.innerHTML = `
            <td style="text-align:center; font-weight:600; ${!rowStyle ? 'background:#f8fafc;' : ''}">${index + 1}</td>
            <td style="text-align:center; font-size:11px;">${displayTypeLabel}</td>
            <td style="text-align:center; font-size:11px; color:#64748b;">${date}</td>
            <td style="text-align:center; font-size:11px;">${codeDisplay}</td>
            <td style="text-align:center; font-size:11px;">${facilityText}</td>
            <td>${paySelf.toLocaleString()}</td>
            <td style="color:#94a3b8;">${payNHIS.toLocaleString()}</td>
            <td>${payFull.toLocaleString()}</td>
            <td>${nonPaySelect.toLocaleString()}</td>
            <td>${nonPayOther.toLocaleString()}</td>
            <td style="background:#f1f5f9; font-weight:600;">${currentTotalCost.toLocaleString()}</td>
            <td style="background:#eff6ff;">${formatCalc(calc1)}</td>
            <td style="background:#eff6ff;">${formatCalc(calc2)}</td>
            <td style="background:#eff6ff;">${formatCalc(calc3)}</td>
            <td style="background:#eff6ff;">${formatCalc(calc4)}</td>
        `;
        summaryBody.appendChild(tr);
    });

    document.getElementById('sumPaySelf').textContent = totalPaySelf.toLocaleString();
    document.getElementById('sumPayNHIS').textContent = totalPayNHIS.toLocaleString();
    document.getElementById('sumPayFull').textContent = totalPayFull.toLocaleString();
    document.getElementById('sumNonPaySelect').textContent = totalNonPaySelect.toLocaleString();
    document.getElementById('sumNonPayOther').textContent = totalNonPayOther.toLocaleString();

    document.getElementById('calcGen1').innerHTML = grandCalcGen1.toLocaleString();
    document.getElementById('calcGen2').innerHTML = grandCalcGen2.toLocaleString();
    document.getElementById('calcGen3').innerHTML = grandCalcGen3.toLocaleString();
    document.getElementById('calcGen4').innerHTML = grandCalcGen4.toLocaleString();
}

function getVal(input) {
    if (!input) return 0;
    const valStr = input.value || input.textContent || '';
    return parseInt(valStr.replace(/[^\d]/g, '')) || 0;
}

function calculateComparison() {
    updateSummary(); // Ensure data is fresh
    resultGrid.innerHTML = '';

    const generations = ['gen1', 'gen2', 'gen3', 'gen4'];
    // We can use the Grand Totals calculated in updateSummary if we want, 
    // but building the card UI is still needed.
    // Let's grab values from footer for consistency
    const total1 = getVal({ textContent: document.getElementById('calcGen1').textContent });
    const total2 = getVal({ textContent: document.getElementById('calcGen2').textContent });
    const total3 = getVal({ textContent: document.getElementById('calcGen3').textContent });
    const total4 = getVal({ textContent: document.getElementById('calcGen4').textContent });

    const totals = { gen1: total1, gen2: total2, gen3: total3, gen4: total4 };

    generations.forEach(genKey => {
        const config = GENERATION_CONFIG[genKey];
        const val = totals[genKey];

        const card = document.createElement('div');
        card.className = `comparison-card ${genKey}`;
        card.innerHTML = `
            <div class="comp-header">
                <h3>${config.name}</h3>
                <span class="comp-badge">${config.limitInfo}</span>
            </div>
            <div class="comp-amount">${val.toLocaleString()}원</div>
            <div class="comp-desc">${config.desc}</div>
        `;
        resultGrid.appendChild(card);
    });

    resultContainer.style.display = 'block';
    setTimeout(() => {
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// ... (Excel Functions remain same, just ensure handleExcelDownload uses new data structure if needed)
function handleTemplateDownload() {
    if (typeof XLSX === 'undefined') {
        alert('엑셀 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    // Updated Template to match new logic
    const data = [
        ['진료일자', '진료형태(통원/입원)', '의료기관', '급여_본인부담금', '급여_공단부담금', '급여_전액본인부담금', '비급여_선택진료료', '비급여_선택외', '질병코드'],
        ['2024-02-09', '통원', '의원', 15000, 30000, 0, 0, 2000, 'J20'],
        ['2024-02-10', '입원', '병원', 50000, 100000, 0, 10000, 0, 'A00']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto-adjust column widths
    const wscols = [
        { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "입력양식");

    // Trigger Download
    XLSX.writeFile(wb, "실손보험_입력양식.xlsx");
}

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { alert('Library Error'); return; }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (confirm('덮어쓰시겠습니까?')) {
            receiptsContainer.innerHTML = '';
            receiptCount = 0;
            updateSummary();
        }

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            let isValid = true;

            // 1. Date Parsing & Validation
            let dateVal = '';
            try {
                if (typeof row[0] === 'number') {
                    // Excel serial date to JS Date
                    dateVal = new Date(Math.round((row[0] - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                } else {
                    dateVal = String(row[0]).trim();
                }

                // Regex check (YYYY-MM-DD)
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dateVal)) throw new Error("Format Error");

                // Logic check (e.g. Month 14)
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) throw new Error("Invalid Date");
            } catch (e) {
                isValid = false;
                dateVal = '-'; // Mark as invalid
            }

            // 2. Type Parsing & Validation
            // Expecting: "통원", "outpatient", "입원", "inpatient"
            const rawType = (row[1] || '').trim();
            let type = 'outpatient'; // Default to outpatient for radio value, but if invalid -> costs become 0

            if (rawType.includes('입원') || rawType === 'inpatient') {
                type = 'inpatient';
            } else if (rawType.includes('통원') || rawType === 'outpatient') {
                type = 'outpatient';
            } else {
                // Any typo (e.g., "톱원") -> Invalid
                isValid = false;
            }

            // 3. Facility Parsing
            let facility = 'clinic';
            const fRaw = (row[2] || '').trim();
            if (fRaw.includes('병원')) facility = 'hospital';
            if (fRaw.includes('종합')) facility = 'general';
            if (fRaw.includes('상급')) facility = 'tertiary';
            if (fRaw.includes('약국')) facility = 'pharmacy';

            // 4. Construct Data (If invalid, costs are 0)
            addReceipt({
                date: isValid ? dateVal : '-',
                type: type, // Pass mapped type
                facility: facility,
                code: row[8] || '',
                paySelf: isValid ? (parseInt(row[3]) || 0) : 0,
                payNHIS: isValid ? (parseInt(row[4]) || 0) : 0,
                payFull: isValid ? (parseInt(row[5]) || 0) : 0,
                nonPaySelect: isValid ? (parseInt(row[6]) || 0) : 0,
                nonPayOther: isValid ? (parseInt(row[7]) || 0) : 0,
                isError: !isValid // FLAG FOR UI
            });
        }
        excelUpload.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function handleExcelDownload() {
    const cards = document.querySelectorAll('.receipt-card');
    if (cards.length === 0) { alert('데이터가 없습니다.'); return; }

    // Headers
    const data = [[
        '번호', '진료형태', '진료일자', '질병코드', '의료기관',
        '급여_본인부담', '급여_공단부담', '급여_전액본인', '비급여_선택진료', '비급여_이외',
        '진료비총액',
        '1세대_예상지급액', '2세대_예상지급액', '3세대_예상지급액', '4세대_예상지급액'
    ]];

    cards.forEach((card, index) => {
        // 1. Extract Inputs
        const date = card.querySelector('.receipt-date').value;
        const facilitySelect = card.querySelector('.facility-select');
        const facilityText = facilitySelect.options[facilitySelect.selectedIndex].text;
        const facility = facilitySelect.value;
        const code = card.querySelector('.disease-code').value;

        // 2. Extract Costs
        const paySelf = getVal(card.querySelector('.cost-pay-self'));
        const payNHIS = getVal(card.querySelector('.cost-pay-nhis'));
        const payFull = getVal(card.querySelector('.cost-pay-full'));
        const nonPaySelect = getVal(card.querySelector('.cost-nonpay-select'));
        const nonPayOther = getVal(card.querySelector('.cost-nonpay-other'));

        const totalCost = paySelf + payNHIS + payFull + nonPaySelect + nonPayOther;

        // 3. Extract Type (Per Card Logic)
        const radioIn = card.querySelector('.type-input[value="inpatient"]');
        const treatmentType = (radioIn && radioIn.checked) ? 'inpatient' : 'outpatient';
        const typeLabel = treatmentType === 'inpatient' ? '입원' : '통원';

        // 4. Calculate
        const payBase = paySelf + payFull;
        const nonPayBase = nonPaySelect + nonPayOther;

        const c1 = GENERATION_CONFIG.gen1.calc(payBase, nonPayBase, treatmentType, facility);
        const c2 = GENERATION_CONFIG.gen2.calc(payBase, nonPayBase, treatmentType, facility);
        const c3 = GENERATION_CONFIG.gen3.calc(payBase, nonPayBase, treatmentType, facility);
        const c4 = GENERATION_CONFIG.gen4.calc(payBase, nonPayBase, treatmentType, facility);

        data.push([
            index + 1, typeLabel, date, code, facilityText,
            paySelf, payNHIS, payFull, nonPaySelect, nonPayOther,
            totalCost,
            c1, c2, c3, c4
        ]);
    });

    // Generate Excel
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Widths
    const wscols = [
        { wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "계산결과");

    XLSX.writeFile(wb, `실손보험_계산결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


