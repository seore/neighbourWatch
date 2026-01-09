import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/supabase';

interface AlertType {
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
  vehicle_plate?: string;
  created_at: string;
}

interface VigilanteGroup {
  id: number;
  name: string;
  status: 'online' | 'offline';
  members: number;
  contact: string;
  emergency_contact?: string;
}

interface Comment {
  id: number;
  alert_id: number;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export default function NeighborWatch() {
  const [currentView, setCurrentView] = useState<'feed' | 'visitors' | 'vigilante'>('feed');
  const [showReport, setShowReport] = useState(false);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertType | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [vigilanteGroups, setVigilanteGroups] = useState<VigilanteGroup[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

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
    duration: '2',
    vehicle_plate: ''
  });

  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [pendingVisitors, setPendingVisitors] = useState(0);

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

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
      const activeAlerts = data?.filter(a => a.status === 'active').length || 0;
      setUnreadAlerts(activeAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchVisitors = async () => {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVisitors(data || []);
      const pending = data?.filter(v => v.status === 'pending').length || 0;
      setPendingVisitors(pending);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

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
    }
  };

  const fetchComments = async (alertId: number) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const alertsChannel = supabase
      .channel('alerts-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAlerts(prev => [payload.new as AlertType, ...prev]);
            showNotification('New Alert!', (payload.new as AlertType).title);
          } else if (payload.eventType === 'UPDATE') {
            setAlerts(prev => prev.map(a => 
              a.id === payload.new.id ? payload.new as AlertType : a
            ));
          } else if (payload.eventType === 'DELETE') {
            setAlerts(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const visitorsChannel = supabase
      .channel('visitors-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setVisitors(prev => [payload.new as Visitor, ...prev]);
            showNotification('New Visitor', `${(payload.new as Visitor).name} registered`);
          } else if (payload.eventType === 'UPDATE') {
            setVisitors(prev => prev.map(v => 
              v.id === payload.new.id ? payload.new as Visitor : v
            ));
          }
        }
      )
      .subscribe();

    const vigilanteChannel = supabase
      .channel('vigilante-channel')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vigilante_groups' },
        () => fetchVigilanteGroups()
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('comments-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          if (selectedAlert && payload.new && (payload.new as Comment).alert_id === selectedAlert.id) {
            fetchComments(selectedAlert.id);
          }
        }
      )
      .subscribe();

    return () => {
      alertsChannel.unsubscribe();
      visitorsChannel.unsubscribe();
      vigilanteChannel.unsubscribe();
      commentsChannel.unsubscribe();
    };
  };

  const showNotification = (title: string, message: string) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleSubmitReport = async () => {
    if (!reportForm.title || !reportForm.description || !reportForm.location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

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
      
      if (reportForm.type === 'emergency') {
        Alert.alert('Emergency Alert', 'Security teams have been notified!', [
          { text: 'Call Security Now', onPress: () => callEmergency() },
          { text: 'OK' }
        ]);
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  const handleSubmitVisitor = async () => {
    if (!visitorForm.name || !visitorForm.phone || !visitorForm.purpose) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('visitors')
        .insert([{
          name: visitorForm.name,
          phone: visitorForm.phone,
          host: 'Your House',
          purpose: visitorForm.purpose,
          status: 'pending',
          duration: `${visitorForm.duration} hours`,
          vehicle_plate: visitorForm.vehicle_plate || null
        }]);

      if (error) throw error;

      setVisitorForm({ name: '', phone: '', purpose: '', duration: '2', vehicle_plate: '' });
      setShowVisitorForm(false);
      Alert.alert('Success', 'Visitor registered successfully!');
    } catch (error) {
      console.error('Error registering visitor:', error);
      Alert.alert('Error', 'Failed to register visitor');
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

  const resolveAlert = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'resolved' })
        .eq('id', id);

      if (error) throw error;
      Alert.alert('Success', 'Alert marked as resolved');
    } catch (error) {
      console.error('Error resolving alert:', error);
      Alert.alert('Error', 'Failed to resolve alert');
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedAlert) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert([{
          alert_id: selectedAlert.id,
          user_name: 'You',
          comment_text: newComment.trim()
        }]);

      if (error) throw error;

      await supabase
        .from('alerts')
        .update({ comments: selectedAlert.comments + 1 })
        .eq('id', selectedAlert.id);

      setNewComment('');
      fetchComments(selectedAlert.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const callEmergency = async () => {
    const emergencyNumber = '0803456789';
    try {
      const supported = await Linking.canOpenURL(`tel:${emergencyNumber}`);
      if (supported) {
        await Linking.openURL(`tel:${emergencyNumber}`);
      } else {
        Alert.alert(
          'Emergency Contact',
          `Call this number: ${emergencyNumber}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Emergency Contact',
        `Please call: ${emergencyNumber}`,
        [{ text: 'OK' }]
      );
    }
  };

  const callSecurityTeam = async (contact: string) => {
    try {
      const supported = await Linking.canOpenURL(`tel:${contact}`);
      if (supported) {
        await Linking.openURL(`tel:${contact}`);
      } else {
        Alert.alert(
          'Security Contact',
          `Call this number: ${contact}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Security Contact',
        `Please call: ${contact}`,
        [{ text: 'OK' }]
      );
    }
  };

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
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getAlertColor = (type: string) => {
    switch(type) {
      case 'emergency': return { bg: '#FEF2F2', border: '#DC2626', icon: '🚨' };
      case 'suspicious': return { bg: '#FFF7ED', border: '#EA580C', icon: '⚠️' };
      case 'info': return { bg: '#EFF6FF', border: '#2563EB', icon: 'ℹ️' };
      default: return { bg: '#F9FAFB', border: '#6B7280', icon: '📢' };
    }
  };

  const openComments = (alert: AlertType) => {
    setSelectedAlert(alert);
    fetchComments(alert.id);
    setShowComments(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F766E" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.loadingText}>Loading NeighborWatch...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F766E" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>🛡️ NeighbourWatch</Text>
            <View style={styles.headerSubtitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.headerSubtitle}>Friends Colony Estate</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.sosButton}
            onPress={callEmergency}
          >
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentView === 'feed' && styles.tabActive]}
          onPress={() => setCurrentView('feed')}
        >
          <Text style={[styles.tabIcon, currentView === 'feed' && styles.tabIconActive]}>🔔</Text>
          <Text style={[styles.tabText, currentView === 'feed' && styles.tabTextActive]}>Alerts</Text>
          {unreadAlerts > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadAlerts}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentView === 'visitors' && styles.tabActive]}
          onPress={() => setCurrentView('visitors')}
        >
          <Text style={[styles.tabIcon, currentView === 'visitors' && styles.tabIconActive]}>👥</Text>
          <Text style={[styles.tabText, currentView === 'visitors' && styles.tabTextActive]}>Visitors</Text>
          {pendingVisitors > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingVisitors}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentView === 'vigilante' && styles.tabActive]}
          onPress={() => setCurrentView('vigilante')}
        >
          <Text style={[styles.tabIcon, currentView === 'vigilante' && styles.tabIconActive]}>🛡️</Text>
          <Text style={[styles.tabText, currentView === 'vigilante' && styles.tabTextActive]}>Security</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} tintColor="#0F766E" />
        }
      >
        {/* Alerts Feed */}
        {currentView === 'feed' && (
          <View style={styles.feedContainer}>
            {alerts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyStateText}>No alerts yet</Text>
                <Text style={styles.emptyStateSubtext}>Your neighborhood is secure</Text>
              </View>
            ) : (
              alerts.map(alert => {
                const colors = getAlertColor(alert.type);
                return (
                  <View key={alert.id} style={[styles.alertCard, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}>
                    <View style={styles.alertHeader}>
                      <View style={styles.alertTop}>
                        <Text style={styles.alertIcon}>{colors.icon}</Text>
                        <View style={styles.alertTitleContainer}>
                          <Text style={styles.alertTitle}>{alert.title}</Text>
                          <View style={styles.alertMetaRow}>
                            <Text style={styles.alertMeta}>📍 {alert.location}</Text>
                            <Text style={styles.alertMeta}>•</Text>
                            <Text style={styles.alertMeta}>{getTimeAgo(alert.created_at)}</Text>
                          </View>
                        </View>
                        {alert.status === 'resolved' ? (
                          <View style={styles.resolvedBadge}>
                            <Text style={styles.resolvedText}>✓</Text>
                          </View>
                        ) : (
                          <View style={styles.activeBadge}>
                            <View style={styles.activePulse} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.alertDescription}>{alert.description}</Text>
                      <Text style={styles.alertReporter}>Reported by {alert.reporter}</Text>
                    </View>
                    <View style={styles.alertActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => openComments(alert)}
                      >
                        <Text style={styles.actionButtonText}>💬 {alert.comments}</Text>
                      </TouchableOpacity>
                      {alert.status === 'active' && (
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.resolveButton]}
                          onPress={() => resolveAlert(alert.id)}
                        >
                          <Text style={styles.resolveButtonText}>✓ Resolve</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Visitors Management */}
        {currentView === 'visitors' && (
          <View style={styles.feedContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowVisitorForm(true)}
            >
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>Register New Visitor</Text>
            </TouchableOpacity>

            {visitors.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyStateText}>No visitors</Text>
                <Text style={styles.emptyStateSubtext}>Register visitors for quick access</Text>
              </View>
            ) : (
              visitors.filter(v => v.status !== 'rejected').map(visitor => (
                <View key={visitor.id} style={styles.visitorCard}>
                  <View style={styles.visitorHeader}>
                    <View style={styles.visitorAvatar}>
                      <Text style={styles.visitorAvatarText}>{visitor.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.visitorInfo}>
                      <Text style={styles.visitorName}>{visitor.name}</Text>
                      <Text style={styles.visitorDetail}>📞 {visitor.phone}</Text>
                      {visitor.vehicle_plate && (
                        <Text style={styles.visitorDetail}>🚗 {visitor.vehicle_plate}</Text>
                      )}
                    </View>
                    <View style={visitor.status === 'approved' ? styles.statusApproved : styles.statusPending}>
                      <Text style={styles.statusText}>{visitor.status === 'approved' ? '✓' : '⏳'}</Text>
                    </View>
                  </View>
                  <View style={styles.visitorDetails}>
                    <View style={styles.visitorDetailRow}>
                      <Text style={styles.visitorDetailLabel}>Purpose:</Text>
                      <Text style={styles.visitorDetailValue}>{visitor.purpose}</Text>
                    </View>
                    <View style={styles.visitorDetailRow}>
                      <Text style={styles.visitorDetailLabel}>Host:</Text>
                      <Text style={styles.visitorDetailValue}>{visitor.host}</Text>
                    </View>
                    <View style={styles.visitorDetailRow}>
                      <Text style={styles.visitorDetailLabel}>Duration:</Text>
                      <Text style={styles.visitorDetailValue}>{visitor.duration}</Text>
                    </View>
                    <View style={styles.visitorDetailRow}>
                      <Text style={styles.visitorDetailLabel}>Registered:</Text>
                      <Text style={styles.visitorDetailValue}>{getTimeAgo(visitor.created_at)}</Text>
                    </View>
                  </View>
                  {visitor.status === 'pending' && (
                    <View style={styles.visitorActions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => approveVisitor(visitor.id)}
                      >
                        <Text style={styles.approveBtnText}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => rejectVisitor(visitor.id)}
                      >
                        <Text style={styles.rejectBtnText}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Security Teams */}
        {currentView === 'vigilante' && (
          <View style={styles.feedContainer}>
            <View style={styles.emergencyCard}>
              <Text style={styles.emergencyIcon}>🚨</Text>
              <Text style={styles.emergencyTitle}>Emergency Contact</Text>
              <Text style={styles.emergencySubtitle}>24/7 Security Response</Text>
              <TouchableOpacity 
                style={styles.emergencyButton}
                onPress={callEmergency}
              >
                <Text style={styles.emergencyButtonText}>CALL NOW</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.securityH}>
              <Text style={styles.securityTitle}>Security Teams</Text>
              <Text style={styles.onlineCount}>
                {vigilanteGroups.filter(g => g.status === 'online').length} online
              </Text>
            </View>

            {vigilanteGroups.map(group => (
              <View key={group.id} style={styles.securityCard}>
                <View style={styles.securityH}>
                  <View>
                    <Text style={styles.securityName}>{group.name}</Text>
                    <Text style={styles.securityMembers}>{group.members} members</Text>
                  </View>
                  <View style={group.status === 'online' ? styles.statusOnline : styles.statusOffline}>
                    <View style={[styles.statusDot, group.status === 'online' && styles.statusDotActive]} />
                    <Text style={[styles.statusLabel, group.status === 'online' && styles.statusLabelActive]}>
                      {group.status}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.callButton}
                  onPress={() => callSecurityTeam(group.contact)}
                >
                  <Text style={styles.callButtonText}>📞 Call {group.contact}</Text>
                </TouchableOpacity>
              </View>
            ))}
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeButtons}>
                {(['suspicious', 'emergency', 'info'] as const).map(type => {
                  const colors = getAlertColor(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        reportForm.type === type && { backgroundColor: colors.border }
                      ]}
                      onPress={() => setReportForm({...reportForm, type})}
                    >
                      <Text style={styles.typeButtonIcon}>{colors.icon}</Text>
                      <Text style={[
                        styles.typeButtonText,
                        reportForm.type === type && styles.typeButtonTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={reportForm.title}
                onChangeText={(title) => setReportForm({...reportForm, title})}
                placeholder="Brief description"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reportForm.description}
                onChangeText={(description) => setReportForm({...reportForm, description})}
                placeholder="Provide detailed information..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={reportForm.location}
                onChangeText={(location) => setReportForm({...reportForm, location})}
                placeholder="e.g., Block C, House 17"
                placeholderTextColor="#9CA3AF"
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Visitor Name</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.name}
                onChangeText={(name) => setVisitorForm({...visitorForm, name})}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.phone}
                onChangeText={(phone) => setVisitorForm({...visitorForm, phone})}
                placeholder="080XXXXXXXX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Purpose of Visit</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.purpose}
                onChangeText={(purpose) => setVisitorForm({...visitorForm, purpose})}
                placeholder="e.g., Guest, Plumber, Delivery"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Vehicle Plate (Optional)</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.vehicle_plate}
                onChangeText={(vehicle_plate) => setVisitorForm({...visitorForm, vehicle_plate})}
                placeholder="e.g., LAG-123-XY"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Duration (hours)</Text>
              <TextInput
                style={styles.input}
                value={visitorForm.duration}
                onChangeText={(duration) => setVisitorForm({...visitorForm, duration})}
                placeholder="2"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitVisitor}>
                <Text style={styles.submitButtonText}>Register Visitor</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.commentsScroll} showsVerticalScrollIndicator={false}>
              {comments.length === 0 ? (
                <View style={styles.noCommentsContainer}>
                  <Text style={styles.noCommentsIcon}>💬</Text>
                  <Text style={styles.noComments}>No comments yet</Text>
                  <Text style={styles.noCommentsSubtext}>Be the first to comment</Text>
                </View>
              ) : (
                comments.map(comment => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{comment.user_name.charAt(0)}</Text>
                      </View>
                      <View style={styles.commentInfo}>
                        <Text style={styles.commentUser}>{comment.user_name}</Text>
                        <Text style={styles.commentTime}>{getTimeAgo(comment.created_at)}</Text>
                      </View>
                    </View>
                    <Text style={styles.commentText}>{comment.comment_text}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Add a comment..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
              <TouchableOpacity 
                style={styles.sendButton}
                onPress={addComment}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowReport(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8e8e9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#D1FAE5',
  },
  sosButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sosText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#0F766E',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0F766E',
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: '25%',
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  feedContainer: {
    padding: 18,
  },
  emptyState: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  alertCard: {
    borderRadius: 5,
    marginBottom: 16,
    borderLeftWidth: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    padding: 16,
  },
  alertTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  alertIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  alertTitleContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  alertMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  resolvedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  activeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  alertDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  alertReporter: {
    fontSize: 13,
    color: '#0F766E',
    fontWeight: '600',
  },
  alertActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  resolveButton: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#0F766E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonIcon: {
    fontSize: 24,
    color: 'white',
    marginRight: 8,
    fontWeight: 'bold',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitorCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visitorHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  visitorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  visitorAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  visitorInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  visitorName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  visitorDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusApproved: {
    backgroundColor: '#D1FAE5',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
  },
  visitorDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  visitorDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  visitorDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  visitorDetailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  visitorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  rejectBtnText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 15,
  },
  emergencyCard: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 6,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  emergencyIcon: {
    fontSize: 35,
    marginBottom: 12,
  },
  emergencyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 6,
  },
  emergencySubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
    marginBottom: 20,
  },
  emergencyButton: {
    backgroundColor: 'white',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 25,
  },
  emergencyButtonText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 10,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  onlineCount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  securityCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  securityH: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  securityMembers: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusLabelActive: {
    color: '#047857',
  },
  callButton: {
    backgroundColor: '#0F766E',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  callButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalClose: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  typeButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeButtonText: {
    fontSize: 12,
    textTransform: 'capitalize',
    color: '#6B7280',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  submitButton: {
    backgroundColor: '#0F766E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 17,
  },
  commentsScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  noCommentsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noCommentsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noComments: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  commentCard: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  commentUser: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 15,
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 21,
  },
  commentInputContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
  },
  sendButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#21998fff',
    width: 60,
    height: 60,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 30,
    color: 'white',
    fontWeight: '300',
  },
});