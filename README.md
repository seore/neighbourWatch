# Neighbour Watch - Community Security App

A modern mobile security application for residential estates, enabling real-time incident reporting, visitor management, and emergency response coordination.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)


## ✨ Features

### 🚨 Real-Time Alerts
- **Live Incident Reporting** - Report suspicious activities, emergencies, or general information
- **Instant Notifications** - Get notified immediately when incidents are reported in your area
- **Status Tracking** - Mark incidents as active or resolved
- **Location-Based** - View incidents by specific blocks and locations

### 👥 Visitor Management
- **Pre-Registration** - Register visitors before arrival for faster gate access
- **Approval Workflow** - Approve or reject visitor requests in real-time
- **Vehicle Tracking** - Record visitor vehicle plates for security
- **Duration Management** - Set expected visit duration
- **Live Status Updates** - See visitor approvals sync across all devices

### 💬 Community Engagement
- **Comment Threads** - Discuss incidents with neighbors
- **Real-Time Comments** - See new comments appear instantly
- **User Attribution** - Know who reported each incident
- **Time Tracking** - Live timestamps showing "Just now", "5m ago", etc.

### 🛡️ Security Teams
- **Team Status Monitoring** - See which security teams are online/offline
- **Direct Calling** - One-tap emergency calling to security personnel
- **Multiple Teams** - Coordinate with different security zones
- **Member Count** - Know team availability at a glance

### ⚡ Real-Time Synchronization
- **Live Data Updates** - All changes sync instantly across devices
- **Supabase Realtime** - WebSocket-based real-time database
- **No Refresh Needed** - Updates appear automatically
- **Offline Support** - Pull-to-refresh for manual updates

## 🏗️ Tech Stack

- **Frontend**: React Native with TypeScript
- **Framework**: Expo SDK 54
- **Backend**: Supabase (PostgreSQL + Real-time)
- **State Management**: React Hooks
- **Navigation**: Expo Router
- **UI Components**: React Native built-ins
- **Styling**: StyleSheet API

## 🚀 Getting Started
### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/seore/neighbourWatch.git
   cd neighbourWatch/NeighborWatch
```

2. **Install dependencies**
```bash
   npm install --legacy-peer-deps
```

6. **Start the development server**
```bash
   npx expo start
```

7. **Run on your device**
   - Scan the QR code with Expo Go app
   - Or press `i` for iOS simulator / `a` for Android emulator

## 📱 Screenshots
<img width="1206" height="2622" alt="neighbourW" src="https://github.com/user-attachments/assets/79d37f01-8a67-480e-ad7f-c2f4e78b5698" />

### Production Recommendations

1. **Implement Authentication**
```typescript
   // Add Supabase Auth
   const { data, error } = await supabase.auth.signInWithPassword({
     email: 'user@email.com',
     password: 'password'
   });
```

2. **Tighten RLS Policies**
```sql
   -- Only authenticated users
   CREATE POLICY "Authenticated users only" ON alerts
     FOR ALL USING (auth.role() = 'authenticated');
   
   -- Users can only edit their own content
   CREATE POLICY "Users own content" ON alerts
     FOR UPDATE USING (auth.uid() = user_id);
```

3. **Add User Profiles**
```sql
   CREATE TABLE users (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     full_name TEXT,
     block TEXT,
     house_number TEXT,
     phone TEXT,
     is_verified BOOLEAN DEFAULT false
   );
```

4. **Verify Estate Membership**
   - Add estate code verification
   - Verify resident address before signup
   - Admin approval for new users

## 🚧 Roadmap

- [ ] User authentication & profiles
- [ ] Push notifications
- [ ] Photo/video uploads for incidents
- [ ] Search & filter alerts
- [ ] Analytics dashboard for estate management
- [ ] In-app messaging
- [ ] Scheduled security patrols
- [ ] Emergency alert broadcasts
- [ ] Multi-estate support
- [ ] Dark mode

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Seore**
- GitHub: [@seore](https://github.com/seore)

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- Backend powered by [Supabase](https://supabase.com)
- Inspired by the need for better community security coordination in Nigerian residential estates
