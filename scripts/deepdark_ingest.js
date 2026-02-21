require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'db.sqlite');
const db = new Database(DB_PATH);
const CTI_PATH = process.env.DEEPDARKCTI_PATH || './deepdarkCTI';

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return;
    }
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

const stmt = db.prepare('INSERT INTO leaks (source_file, content, metadata) VALUES (?, ?, ?)');

console.log(`Ingesting data from ${CTI_PATH}...`);

db.transaction(() => {
    walkDir(CTI_PATH, (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (['.json', '.txt', '.md', '.csv'].includes(ext)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                // Limit content size to avoid huge DB
                const truncatedContent = content.substring(0, 10000);
                const metadata = JSON.stringify({
                    size: fs.statSync(filePath).size,
                    extension: ext
                });

                stmt.run(path.relative(CTI_PATH, filePath), truncatedContent, metadata);
                console.log(`Ingested: ${filePath}`);
            } catch (err) {
                console.error(`Failed to ingest ${filePath}:`, err.message);
            }
        }
    });
})();

console.log('Ingestion complete.');
db.close();
