# Jojox Lucky Wheel - Telegram Mini App

## Overview
Telegram Mini App for a Lucky Wheel game where users can spin to win TON cryptocurrency.

## Architecture
- **Backend**: Express.js API server (`artifacts/api-server`) with Telegram Bot integration
- **Frontend**: React + Vite Mini App (`artifacts/app`) at `/app/`
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Bot**: node-telegram-bot-api with polling

## Features

### User Features
1. **Home Page**: Profile picture, username, luck wheel with unique canvas animation, spin counter
2. **Tasks Page**: Complete tasks to earn spins (every 5 tasks = 1 spin)
3. **Referral Page**: Share referral link (every 5 referrals = 1 spin)
4. **Account Page**: Profile, TON balance, withdrawal form (min 0.1 TON)

### Admin Features (accessible via `/admin` route or `/admin` command in bot)
- Only visible to Owner (`@J_O_H_N8`) and registered admins
- **Tasks Management**: Add/delete tasks with optional expiry time
- **Wheel Configuration**: Change amounts and probabilities (must sum to 100%)
- **User Management**: View all users, modify balance and spins
- **Settings**: Set owner Telegram ID for withdrawal notifications, toggle user count visibility
- **Withdrawals**: View all withdrawal requests

### Bot Features
- `/start` - Opens mini app with welcome message
- `/admin` - Opens admin panel (admin only)
- Withdrawal notification to owner with approve/reject buttons
- Referral tracking via `?start=ref_<userId>` parameter

## Wheel Configuration
- Slots: 0.05, 0.1, 0.2, 0.5, 1, 2, 3, 4 TON
- Default probabilities: 35%, 25%, 15%, 10%, 7%, 4%, 3%, 1%
- Admin can change amounts AND probabilities (0% = never appears)

## Setup Required
1. Set `TELEGRAM_BOT_TOKEN` in Replit Secrets
2. After deploying, set the mini app URL via admin settings
3. Set owner Telegram ID in admin settings for withdrawal notifications

## Database Schema
- `users`: User data, balance, spins, referral tracking
- `tasks`: Admin-created tasks with optional expiry
- `user_tasks`: Task completion tracking
- `wheel_slots`: Wheel configuration with amounts and probabilities
- `withdrawals`: Withdrawal requests with status
- `admins`: Admin user IDs
- `bot_settings`: Key-value settings (owner_telegram_id, show_user_count)

## Routes
- `/api/*` - API Server
- `/app/*` - Mini App Frontend
