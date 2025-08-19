const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');

async function parseJudgeCSV(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString());
        
        stream
            .pipe(csv({ headers: false }))
            .on('data', (data) => results.push(Object.values(data)))
            .on('end', () => {
                try {
                    const judgeData = extractJudgeData(results);
                    resolve(judgeData);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => reject(error));
    });
}

function extractJudgeData(csvRows) {
    const classroomRow = csvRows[3] || [];
    const chairRow = csvRows[4] || [];
    const judge1Row = csvRows[5] || [];
    const judge2Row = csvRows[6] || [];
    
    const judgeGroups = [];
    
    for (let i = 0; i < classroomRow.length; i += 2) {
        const classroom = classroomRow[i];
        if (!classroom || !classroom.trim()) continue;
        
        const chair = chairRow[i] && chairRow[i].trim();
        const judge1 = judge1Row[i] && judge1Row[i].trim();
        const judge2 = judge2Row[i] && judge2Row[i].trim();
        
        if (chair || judge1 || judge2) {
            const judges = [chair, judge1, judge2].filter(Boolean);
            judgeGroups.push({
                group: classroom.trim(),
                chair: chair || null,
                judges: judges
            });
        }
    }
    
    return judgeGroups;
}

const csvContent = fs.readFileSync('all-judges.csv');
parseJudgeCSV(csvContent).then(result => {
    console.log('Parsed ' + result.length + ' judge groups:');
    result.forEach((item, index) => {
        console.log((index + 1) + '. ' + item.group + ': Chair=' + item.chair);
        console.log('   All Judges: ' + item.judges.join(', '));
    });
}).catch(err => console.error('Error:', err));