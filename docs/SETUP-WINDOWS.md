# Windows Development Setup

This guide covers setting up the KansRide development environment on Windows.

---

## Prerequisites

- **Windows 10/11** (21H2 or later recommended)
- **Node.js 24+** — download from [nodejs.org](https://nodejs.org) or use `nvm-windows`
- **Git** — [git-scm.com](https://git-scm.com/download/win)
- **VS Code** (recommended) with ESLint + Prettier extensions

---

## 1. Installing PostgreSQL 16 + PostGIS

### Option A: EDB Installer (Recommended)

1. Download PostgreSQL 16 from [enterprisedb.com/downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Run the installer — keep default port `5432`
3. Set password for the `postgres` user (remember this for `.env`)
4. When prompted, launch **Stack Builder** after installation
5. In Stack Builder, select **Spatial Extensions → PostGIS 3.4** and install

### Option B: Using Chocolatey

```powershell
choco install postgresql16 --params '/Password:postgres /Port:5432'
# PostGIS must be installed separately via Stack Builder
```

### Verify Installation

```powershell
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -c "SELECT PostGIS_Version();"
```

### Create the Development Database

```sql
CREATE DATABASE kansride;
\c kansride
CREATE EXTENSION postgis;
```

---

## 2. Installing Redis

### Option A: WSL2 (Recommended)

Redis does not officially support Windows. The best approach is via WSL2:

```powershell
# Install WSL2 if not already installed
wsl --install

# Inside WSL (Ubuntu):
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping
# Should return: PONG
```

Redis in WSL2 is accessible from Windows at `localhost:6379` by default.

### Option B: Memurai (Native Windows)

[Memurai](https://www.memurai.com/) is a Redis-compatible server for Windows:

1. Download from [memurai.com](https://www.memurai.com/get-memurai)
2. Install with default settings (port 6379)
3. Memurai runs as a Windows service automatically

### Verify Redis Connection

```powershell
# If using WSL
wsl redis-cli ping

# If using Memurai
memurai-cli ping
```

---

## 3. Environment Configuration

```powershell
# From project root
Copy-Item .env.example .env
```

Edit `.env` with your local values:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=kansride
DATABASE_USER=postgres
DATABASE_PASSWORD=<your-local-postgres-password>
DATABASE_URL=postgresql://postgres:<URL-encoded-local-password>@localhost:5432/kansride

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# JWT (change in production)
JWT_ACCESS_SECRET=dev-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me

# SMS (mock for local development)
SMS_PROVIDER=mock

# Maps
MAPS_PROVIDER=openstreetmap
```

The backend and migration scripts load this ignored root `.env` automatically.
If the password contains reserved URL characters, URL-encode it in
`DATABASE_URL`. Do not commit `.env`.

---

## 4. Running the Monorepo

### Install Dependencies

```powershell
npm install
```

This installs dependencies for all workspaces (packages + apps).

### Build Shared Packages (Required First)

```powershell
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/shared-config
npm run build --workspace=packages/shared-db
npm run build --workspace=packages/shared-auth
```

### Run Database Migrations

```powershell
npm run db:migrate --workspace=packages/shared-db
```

### Start Applications

```powershell
# Terminal 1: Backend API (port 3000)
npm run dev --workspace=apps/backend

# Terminal 2: Admin Dashboard (port 3001)
npm run dev --workspace=apps/admin-web

# Terminal 3: Tracking Web (port 3002)
npm run dev --workspace=apps/tracking-web

# Terminal 4: Mobile (Expo)
npm run start --workspace=apps/mobile-passenger
```

---

## 5. Common Issues & Troubleshooting

### node-gyp Build Errors

Some native modules require build tools:

```powershell
# Install Windows Build Tools
npm install --global windows-build-tools

# Or install Visual Studio Build Tools manually:
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select "Desktop development with C++" workload
```

If you see `gyp ERR! find Python`, install Python 3.x and ensure it's in your PATH.

### PostGIS Extension Not Found

If `CREATE EXTENSION postgis` fails:
- Ensure PostGIS was installed via Stack Builder (see step 1)
- Check that the PostGIS DLLs are in your PostgreSQL `lib` directory
- Restart the PostgreSQL service after installing PostGIS

### Redis Connection Refused

- **WSL2**: Ensure Redis is running: `wsl sudo systemctl status redis-server`
- **Memurai**: Check Windows Services for "Memurai" service status
- Verify port 6379 is not blocked by Windows Firewall

### Expo / React Native on Windows

- Install the **Expo Go** app on your physical device for testing
- For Android emulator: Install Android Studio and configure an AVD
- iOS development is **not possible** on Windows — use the Expo Go app on a physical iPhone or use EAS Build

### Port Already in Use

```powershell
# Find process using a port (e.g., 3000)
netstat -ano | findstr :3000

# Kill the process by PID
taskkill /PID <pid> /F
```

### Long File Paths

Enable long paths in Windows (requires admin):

```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

Also configure Git:

```powershell
git config --global core.longpaths true
```

### npm Workspace Issues

If workspace linking seems broken:

```powershell
# Clean and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

---

## 6. Recommended VS Code Extensions

- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier** — `esbenp.prettier-vscode`
- **Tailwind CSS IntelliSense** — `bradlc.vscode-tailwindcss`
- **PostgreSQL** — `ckolkman.vscode-postgres`
- **Thunder Client** — `rangav.vscode-thunder-client` (API testing)
- **ES7+ Snippets** — `dsznajder.es7-react-js-snippets`
