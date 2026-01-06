import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../supabase/supabase';

interface Alerts {
  id: number;
  type: 'suspicious' | 'emergency' | 'info';
  title: string;
  description: string;
  location: string;
  reporter: string;
  status: 'active' | 'resolved';
  comments: number;
  created_at: string;
}

interface Visitor {
  id: number;
  name: string;
  phone: string;
  host: string;
  purpose: string;
  status: 'approved' | 'pending' | 'rejected';
  duration: string;
  created_at: string;
}

interface VigilanteGroup {
  id: number;
  name: string;
  status: 'online' | 'offline';
  members: number;
  contact: string;
}

export default function NeighborWatch() {
  const [currentView, setCurrentView] = useState<'feed' | 'visitors' | 'vigilante'>('feed');
  const [showReport, setShowReport] = useState(false);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [alerts, setAlerts] = useState<Alerts[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [vigilanteGroups, setVigilanteGroups] = useState<VigilanteGroup[]>([]);

  const [reportForm, setReportForm] = useState({
    type: 'suspicious' as 'suspicious' | 'emergency' | 'info',
    title: '',
    description: '',
    location: ''
  });

  const [visitorForm, setVisitorForm] = useState({
    name: '',
    phone: '',
    purpose: '',
    duration: '2'
  });

  // Load data on mount
  useEffect(() => {
    loadAllData();
    setupRealtimeSubscriptions();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAlerts(),
      fetchVisitors(),
      fetchVigilanteGroups()
    ]);
    setLoading(false);
  };

  // Fetch Alerts from Supabase
  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      Alert.alert('Error', 'Failed to load alerts');
    }
  };

  // Fetch Visitors from Supabase
  const fetchVisitors = async () => {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVisitors(data || []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      Alert.alert('Error', 'Failed to load visitors');
    }
  };

  // Fetch Vigilante Groups from Supabase
  const fetchVigilanteGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('vigilante_groups')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setVigilanteGroups(data || []);
    } catch (error) {
      console.error('Error fetching vigilante groups:', error);
      Alert.alert('Error', 'Failed to load security teams');
    }
  };

  // Setup real-time subscriptions
  const setupRealtimeSubscriptions = () => {
    // Subscribe to alerts changes
    const alertsSubscription = supabase
      .channel('alerts-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'alerts' },
        () => fetchAlerts()
      )
      .subscribe();

    // Subscribe to visitors changes
    const visitorsSubscription = supabase
      .channel('visitors-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        () => fetchVisitors()
      )
      .subscribe();

    // Subscribe to vigilante groups changes
    const vigilanteSubscription = supabase
      .channel('vigilante-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vigilante_groups' },
        () => fetchVigilanteGroups()
      )
      .subscribe();

    return () => {
      alertsSubscription.unsubscribe();
      visitorsSubscription.unsubscribe();
      vigilanteSubscription.unsubscribe();
    };
  };

  const handleSubmitReport = async () => {
    if (reportForm.title && reportForm.description && reportForm.location) {
      try {
        const { error } = await supabase
          .from('alerts')
          .insert([{
            type: reportForm.type,
            title: reportForm.title,
            description: reportForm.description,
            location: reportForm.location,
            reporter: 'You',
            status: 'active',
            comments: 0
          }]);

        if (error) throw error;

        setReportForm({ type: 'suspicious', title: '', description: '', location: '' });
        setShowReport(false);
        Alert.alert('Success', 'Report submitted successfully!');
      } catch (error) {
        console.error('Error submitting report:', error);
        Alert.alert('Error', 'Failed to submit report');
      }
    } else {
      Alert.alert('Error', 'Please fill in all fields');
    }
  };

   const handleSubmitVisitor = async () => {
    if (visitorForm.name && visitorForm.phone && visitorForm.purpose) {
      try {
        const { error } = await supabase
          .from('visitors')
          .insert([{
            name: visitorForm.name,
            phone: visitorForm.phone,
            host: 'Your House',
            purpose: visitorForm.purpose,
            status: 'pending',
            duration: `${visitorForm.duration} hours`
          }]);

        if (error) throw error;

        setVisitorForm({ name: '', phone: '', purpose: '', duration: '2' });
        setShowVisitorForm(false);
        Alert.alert('Success', 'Visitor registered successfully!');
      } catch (error) {
        console.error('Error registering visitor:', error);
        Alert.alert('Error', 'Failed to register visitor');
      }
    } else {
      Alert.alert('Error', 'Please fill in all fields');
    }
  };

  const approveVisitor = async (id: number) => {
    try {
      const { error } = await supabase
        .from('visitors')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      Alert.alert('Approved', 'Visitor has been approved');
    } catch (error) {
      console.error('Error approving visitor:', error);
      Alert.alert('Error', 'Failed to approve visitor');
    }
  };

  // Reject visitor
  const rejectVisitor = async (id: number) => {
    Alert.alert('Confirm', 'Reject this visitor?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('visitors')
              .update({ status: 'rejected' })
              .eq('id', id);

            if (error) throw error;
            Alert.alert('Rejected', 'Visitor has been rejected');
          } catch (error) {
            console.error('Error rejecting visitor:', error);
            Alert.alert('Error', 'Failed to reject visitor');
          }
        },
        style: 'destructive'
      }
    ]);
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const getAlertColor = (type: string) => {
    switch(type) {
      case 'emergency': return '#FEE2E2';
      case 'suspicious': return '#FFEDD5';
      case 'info': return '#DBEAFE';
      default: return '#F3F4F6';
    }
  };

  const getAlertBorderColor = (type: string) => {
    switch(type) {
      case 'emergency': return '#EF4444';
      case 'suspicious': return '#F97316';
      case 'info': return '#3B82F6';
      default: return '#9CA3AF';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#16A34A" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Loading NeighborWatch...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16A34A" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>NeighborWatch</Text>
          <Text style={styles.headerSubtitle}>Lekki Gardens Estate</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentView === 'feed' && styles.tabActive]}
          onPress={() => setCurrentView('feed')}
        >
          <Text style={[styles.tabText, currentView === 'feed' && styles.tabTextActive]}>
            🔔 Alerts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentView === 'visitors' && styles.tabActive]}
          onPress={() => setCurrentView('visitors')}
        >
          <Text style={[styles.tabText, currentView === 'visitors' && styles.tabTextActive]}>
            👥 Visitors
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentView === 'vigilante' && styles.tabActive]}
          onPress={() => setCurrentView('vigilante')}
        >
          <Text style={[styles.tabText, currentView === 'vigilante' && styles.tabTextActive]}>
            🛡️ Security
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />
        }
      >
        {/* Alerts Feed */}
        {currentView === 'feed' && (
          <View>
            <View style={styles.locationCard}>
              <Text style={styles.locationText}>📍 You are in Block C, House 17</Text>
            </View>

            {alerts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No alerts yet</Text>
                <Text style={styles.emptyStateSubtext}>Tap the red button to report an incident</Text>
              </View>
            ) : (
              alerts.map(alert => (
                <View key={alert.id} style={[styles.alertCard, { backgroundColor: getAlertColor(alert.type), borderLeftColor: getAlertBorderColor(alert.type) }]}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertTitleRow}>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text style={alert.status === 'resolved' ? styles.statusResolved : styles.statusActive}>
                        {alert.status === 'resolved' ? '✓' : '⚠️'}
                      </Text>
                    </View>
                    <Text style={styles.alertDescription}>{alert.description}</Text>
                  </View>
                  <View style={styles.alertFooter}>
                    <Text style={styles.alertMeta}>📍 {alert.location}</Text>
                    <Text style={styles.alertMeta}>🕐 {getTimeAgo(alert.created_at)}</Text>
                    <Text style={styles.alertReporter}>By: {alert.reporter}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Visitors Management */}
        {currentView === 'visitors' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Visitor Management</Text>
              <Text style={styles.cardSubtitle}>Pre-register visitors for faster gate access</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowVisitorForm(true)}
              >
                <Text style={styles.primaryButtonText}>Register New Visitor</Text>
              </TouchableOpacity>
            </View>

            {visitors.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No visitors registered</Text>
                <Text style={styles.emptyStateSubtext}>Register visitors for quick gate access</Text>
              </View>
            ) : (
              visitors.filter(v => v.status !== 'rejected').map(visitor => (
                <View key={visitor.id} style={styles.visitorCard}>
                  <View style={styles.visitorHeader}>
                    <View>
                      <Text style={styles.visitorName}>{visitor.name}</Text>
                      <Text style={styles.visitorPhone}>{visitor.phone}</Text>
                    </View>
                    <View style={visitor.status === 'approved' ? styles.statusApproved : styles.statusPending}>
                      <Text style={styles.statusText}>{visitor.status}</Text>
                    </View>
                  </View>
                  <View style={styles.visitorDetails}>
                    <Text style={styles.visitorDetail}>Purpose: {visitor.purpose}</Text>
                    <Text style={styles.visitorDetail}>Host: {visitor.host}</Text>
                    <Text style={styles.visitorDetail}>Duration: {visitor.duration}</Text>
                    <Text style={styles.visitorDetail}>Registered: {getTimeAgo(visitor.created_at)}</Text>
                  </View>
                  {visitor.status === 'pending' && (
                    <View style={styles.visitorActions}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => approveVisitor(visitor.id)}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => rejectVisitor(visitor.id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Vigilante Groups */}
        {currentView === 'vigilante' && (
          <View>
            <View style={styles.emergencyCard}>
              <Text style={styles.emergencyTitle}>Emergency Contact</Text>
              <Text style={styles.emergencySubtitle}>Tap to call security immediately</Text>
              <TouchableOpacity style={styles.emergencyButton}>
                <Text style={styles.emergencyButtonText}>📞 Call Estate Security</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security Teams</Text>
              {vigilanteGroups.length === 0 ? (
                <Text style={styles.emptyStateSubtext}>No security teams available</Text>
              ) : (
                vigilanteGroups.map(group => (
                  <View key={group.id} style={styles.securityTeam}>
                    <View style={styles.securityTeamHeader}>
                      <View>
                        <Text style={styles.securityTeamName}>{group.name}</Text>
                        <Text style={styles.securityTeamMembers}>{group.members} members</Text>
                      </View>
                      <View style={group.status === 'online' ? styles.statusOnline : styles.statusOffline}>
                        <Text style={styles.statusDot}>●</Text>
                        <Text style={styles.statusText}>{group.status}</Text>
                      </View>
                    </View>
                    <TouchableOpacity>
                      <Text style={styles.contactLink}>📞 {group.contact}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={showReport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Incident</Text>
              <TouchableOpacity onPress={() => setShowReport(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeButtons}>
                {(['suspicious', 'emergency', 'info'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, reportForm.type === type && styles.typeButtonActive]}
                    onPress={() => setReportForm({...reportForm, type})}
                  >
                    <Text style={[styles.typeButtonText, reportForm.type === type && styles.typeButtonTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={reportForm.title}
                onChangeText={(title) => setReportForm({...reportForm, title})}
                placeholder="Brief description"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reportForm.description}
                onChangeText={(description) => setReportForm({...reportForm, description})}
                placeholder="Provide detailed information..."
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={reportForm.location}
                onChangeText={(location) => setReportForm({...reportForm, location})}
                placeholder="e.g., Block C, House 17"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport}>
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Visitor Form Modal */}
      <Modal visible={showVisitorForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Visitor</Text>
              <TouchableOpacity onPress={() => setShowVisitorForm(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>Visitor Name</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.name}
                onChangeText={(name) => setVisitorForm({...visitorForm, name})}
                placeholder="Full name"
              />

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.phone}
                onChangeText={(phone) => setVisitorForm({...visitorForm, phone})}
                placeholder="080XXXXXXXX"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Purpose of Visit</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.purpose}
                onChangeText={(purpose) => setVisitorForm({...visitorForm, purpose})}
                placeholder="e.g., Guest, Plumber, Delivery"
              />

              <Text style={styles.label}>Expected Duration (hours)</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.duration}
                onChangeText={(duration) => setVisitorForm({...visitorForm, duration})}
                placeholder="2"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitVisitor}>
                <Text style={styles.submitButtonText}>Register Visitor</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowReport(true)}
      >
        <Text style={styles.fabText}>⚠️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#16A34A',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#BBF7D0',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#16A34A',
  },
  tabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#16A34A',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  locationCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertCard: {
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  alertHeader: {
    padding: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  statusResolved: {
    fontSize: 18,
    color: '#16A34A',
  },
  statusActive: {
    fontSize: 18,
    color: '#DC2626',
  },
  alertDescription: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  alertFooter: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  alertMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  alertReporter: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#16A34A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  visitorCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  visitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitorPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  visitorDetails: {
    marginBottom: 12,
  },
  visitorDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  statusApproved: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  visitorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#16A34A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emergencyCard: {
    backgroundColor: '#16A34A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  emergencySubtitle: {
    fontSize: 14,
    color: '#BBF7D0',
    marginBottom: 16,
  },
  emergencyButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: '#16A34A',
    fontWeight: 'bold',
    fontSize: 18,
  },
  securityTeam: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  securityTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  securityTeamName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityTeamMembers: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    fontSize: 8,
  },
  contactLink: {
    fontSize: 14,
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  typeButtonText: {
    fontSize: 14,
    textTransform: 'capitalize',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#16A34A',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#DC2626',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
  },
});