# Dark Web Credential and Data Breach Monitoring Service

A web application for monitoring and alerting users about compromised credentials and data breaches.

## Features
- **User Authentication**: Secure registration and login.
- **Credential Monitoring**: Users can add identifiers (emails, usernames) to monitor.
- **Leak Detection**: Integrates with LeakCheck.io API to check for breaches.
- **Dashboard**: View monitoring status and alerts.
- **Admin Dashboard**: (Optional/Planned) For monitoring system activity.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd darkwebmonitor
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and add your configuration (API keys, secrets).

4.  **Initialize Database:**
    ```bash
    npm run init-db
    ```

## Usage

1.  **Start the server:**
    ```bash
    npm start
    ```

2.  **Access the application:**
    Open your browser and navigate to `http://localhost:3001`.

## Project Structure
- `server.js`: Main application entry point.
- `static/`: Frontend files (HTML, CSS, JS).
- `scripts/`: Utility scripts (DB init, data ingest).
- `data/`: SQLite database storage.
