# SAMS Connect — Student Portal & Attendance

Student / Doctor / Admin portal with QR & barcode check-in, absence log, course registration,
fees, gradebook, weekly schedule, academic calendar and Excel reports. English + Arabic (RTL).

## Run it on your PC

1. Install **Node.js 20 LTS or newer** from https://nodejs.org (choose the LTS installer).
2. Unzip this folder, open a terminal in it (Windows: right-click the folder → "Open in Terminal").
3. Install packages (first time only):
   ```
   npm install
   ```
4. Start the app:
   ```
   npm run dev
   ```
5. Open **http://localhost:5000** in your browser.

Stop it with `Ctrl + C`.

### Production mode (faster)
```
npm run build
npm start
```

### Demo logins (password `123456`)
| Role | Sign in with |
|---|---|
| Student | 20251047 |
| Doctor | ahmed.salah@sams.edu.eg |
| Admin | admin@sams.edu.eg |

### Data
All data is stored in the file `sams.db` (SQLite) in this folder. It is created and filled with
demo data on first start. Delete `sams.db` (and `sams.db-wal`, `sams.db-shm`) to reset everything.

### Use a different port
Windows PowerShell: `$env:PORT=3000; npm run dev`  ·  macOS/Linux: `PORT=3000 npm run dev`

### Open it from your phone (same Wi-Fi)
Find your PC's IP address (Windows: `ipconfig`) and open `http://YOUR-IP:5000` on the phone.
The camera scanner needs HTTPS or localhost, so on the phone use the simulator or type IDs.

### Troubleshooting
- `npm install` fails on **better-sqlite3**: make sure you use Node 20 or 22 LTS. If it still fails on
  Windows, install "Desktop development with C++" from Visual Studio Build Tools, then run `npm install` again.
- "Port 5000 is already in use": use another port (see above).
