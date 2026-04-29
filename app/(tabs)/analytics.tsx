import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { auth, db } from '@/constants/FirebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, {attended: number; total: number}>>({});
  const [markedDates, setMarkedDates] = useState<Record<string, {selected: boolean; selectedColor: string}>>({});

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // 1. Fetch Subject Stats
      const statsDoc = await getDoc(doc(db, 'user_stats', user.uid));
      if (statsDoc.exists()) {
        setAttendance(statsDoc.data().subjects || {});
      }

      // 2. Fetch Attendance History (Calendar Dates)
      const historyDoc = await getDoc(doc(db, 'attendance_history', user.uid));
      if (historyDoc.exists()) {
        const historyData = historyDoc.data().dates || {};
        const formattedDates: Record<string, {selected: boolean; selectedColor: string}> = {};
        
        Object.keys(historyData).forEach(date => {
          const status = historyData[date];
          formattedDates[date] = {
            selected: true,
            selectedColor: status === 'perfect' ? '#34C759' : '#FF3B30'
          };
        });
        setMarkedDates(formattedDates);
      }

    } catch (error) {
      console.error("Analytics Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const subjects = Object.keys(attendance);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Insights</Text>
        <Text style={styles.subtitle}>Deep dive into your attendance habits</Text>
      </View>

      {/* Attendance Calendar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attendance History</Text>
        {Object.keys(markedDates).length > 0 ? (
          <View style={styles.calendarGrid}>
            {Object.entries(markedDates).sort().map(([date, info]) => (
              <View key={date} style={styles.calendarItem}>
                <View style={[styles.calendarDot, { backgroundColor: info.selectedColor }]} />
                <Text style={styles.calendarDate}>{date.split('-')[2]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>Mark your attendance on the dashboard to see history here.</Text>
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#34C759' }]} />
            <Text style={styles.legendText}>Attended All</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
            <Text style={styles.legendText}>Bunked One or More</Text>
          </View>
        </View>
      </View>

      {/* Subject Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Subject Breakdown</Text>
      </View>

      {subjects.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="bar-chart-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyCardText}>No attendance data yet</Text>
          <Text style={styles.emptyCardHint}>Mark classes on the Dashboard to see stats here.</Text>
        </View>
      ) : (
        subjects.map((sub) => {
          const stats = attendance[sub];
          const percent = stats.total === 0 ? 0 : stats.attended / stats.total;
          const isLow = percent < 0.75;

          return (
            <View key={sub} style={styles.statCard}>
              <View style={styles.statInfo}>
                <View>
                  <Text style={styles.subjectName}>{sub}</Text>
                  <Text style={styles.subjectStats}>{stats.attended} / {stats.total} Classes</Text>
                </View>
                <Text style={[styles.percentText, { color: isLow ? '#FF3B30' : '#34C759' }]}>
                  {(percent * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${percent * 100}%`, backgroundColor: isLow ? '#FF3B30' : '#34C759' }]} />
                <View style={[styles.goalMarker, { left: '75%' }]} />
              </View>
              {isLow && (
                <View style={styles.alertBox}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.alertText}>Needs attention to reach 75% goal.</Text>
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
    paddingTop: 10,
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: width * 0.035,
    color: '#666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1A1A1A',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
  },
  calendarItem: {
    alignItems: 'center',
    width: 36,
  },
  calendarDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  calendarDate: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  emptyHint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    elevation: 2,
  },
  emptyCardText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 12,
  },
  emptyCardHint: {
    fontSize: 13,
    color: '#C7C7CC',
    marginTop: 4,
    textAlign: 'center',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  statInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subjectStats: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  percentText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F0',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  alertText: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
