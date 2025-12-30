import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = './slot_booking_prototype_mon_sat.xlsx';
const outputPath = './src/data.json';

try {
    if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        const data = {
            teacherMap: {},
            slots: []
        };

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (json.length > 0) {
                processSheet(json, data);
            }
        });

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log("Data converted and saved to " + outputPath);
    }
} catch (err) {
    console.error(err);
}

function findColIndex(headers, keywords) {
    return headers.findIndex(h => {
        const lower = String(h).toLowerCase();
        return keywords.some(k => lower.includes(k));
    });
}

function processSheet(rows, data) {
    const headers = rows[0].map(h => String(h).toLowerCase().trim());

    // Teachers/Subjects
    const teacherIdx = findColIndex(headers, ['teacher name', 'staff name', 'faculty name']);
    const subjectIdx = findColIndex(headers, ['course name', 'subject name', 'subject']);
    const idIdx = findColIndex(headers, ['id']);
    const codeIdx = findColIndex(headers, ['code']);

    // Slots
    const timeIdx = findColIndex(headers, ['time', 'slot']);
    const dayIdx = findColIndex(headers, ['day']);

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const teacher = row[teacherIdx];

        // Process Map
        if (teacherIdx > -1 && subjectIdx > -1) {
            const subject = row[subjectIdx];
            if (subject && teacher) {
                // Key by Teacher Name to ensure we capture every teacher's subject
                data.teacherMap[teacher] = {
                    subject: subject,
                    id: idIdx > -1 ? row[idIdx] : null,
                    code: codeIdx > -1 ? row[codeIdx] : null
                };
            }
        }

        // Process Slots
        if (teacherIdx > -1 && timeIdx > -1) {
            const time = row[timeIdx];
            const day = (dayIdx > -1 && row[dayIdx]) ? row[dayIdx] : 'Mon';

            if (teacher && time) {
                data.slots.push({
                    teacher: teacher,
                    day: day,
                    time: time,
                    id: Math.random().toString(36).substr(2, 9)
                });
                // Note: In a static build, IDs should probably be deterministic or index-based if we want persistency, 
                // but for a session-based prototype, random is fine.
            }
        }
    }
}
