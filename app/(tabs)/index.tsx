import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { auth, db } from '@/constants/FirebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface ClassSlot {
  subject: string;
  startTime: string;
  endTime: string;
  marked?: 'present' | 'absent' | null;
}

interface SubjectStat {
  attended: number;
  total: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{name: string; branch: string; semester: string; role: string} | null>(null);
  const [todayClasses, setTodayClasses] = useState<ClassSlot[]>([]);
  const [attendance, setAttendance] = useState<Record<string, SubjectStat>>({});
  const [massBunk, setMassBunk] = useState<{votes: number}>({votes: 0});
  const [monthlyStats, setMonthlyStats] = useState({ attended: 0, total: 0, goal: 75 });
  const [isMassBunked, setIsMassBunked] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleMassBunkJoin = () => {
    if (isMassBunked) return;
    setIsMassBunked(true);
    setMassBunk(prev => ({ ...prev, votes: prev.votes + 1 }));
    Alert.alert("Joined!", "You've joined the mass bunk plan. Unity is strength!");
  };

  const fetchDashboardData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Get User Data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let currentBranch = "N/A";
      let currentSem = "N/A";

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData({
          name: data.name || "User",
          branch: data.branch || "N/A",
          semester: data.semester || "N/A",
          role: data.role || "student"
        });
        currentBranch = data.branch || "N/A";
        currentSem = data.semester || "N/A";
      } else {
        setUserData({ name: user.email?.split('@')[0] || "User", branch: "N/A", semester: "N/A", role: "student" });
      }

      // 2. Get Today's Classes from Timetable
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = dayNames[new Date().getDay()];
      
      if (currentBranch !== "N/A") {
        const timetableDoc = await getDoc(doc(db, 'timetables', `${currentBranch}_${currentSem}`));
        if (timetableDoc.exists()) {
          const fullTimetable = timetableDoc.data();
          const classes = fullTimetable[today] || [];
          setTodayClasses(classes.map((c: ClassSlot) => ({ ...c, marked: null })));
        }
      }

      // 3. Get User Stats
      const statsDoc = await getDoc(doc(db, 'user_stats', user.uid));
      if (statsDoc.exists()) {
        const subjects = statsDoc.data().subjects || {};
        setAttendance(subjects);
        
        // Calculate monthly stats from subjects
        let totalAttended = 0;
        let totalClasses = 0;
        Object.values(subjects).forEach((stat: unknown) => {
          const s = stat as SubjectStat;
          totalAttended += s.attended;
          totalClasses += s.total;
        });
        setMonthlyStats({ attended: totalAttended, total: totalClasses || 1, goal: 75 });
      }

    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (index: number, status: 'present' | 'absent') => {
    const user = auth.currentUser;
    if (!user) return;

    const updated = [...todayClasses];
    updated[index] = { ...updated[index], marked: status };
    setTodayClasses(updated);

    try {
      const sub = updated[index].subject;
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Update Subject Stats
      const newStats = { ...attendance };
      if (!newStats[sub]) newStats[sub] = { attended: 0, total: 0 };
      
      if (status === 'present') {
        newStats[sub] = { ...newStats[sub], attended: newStats[sub].attended + 1 };
      }
      newStats[sub] = { ...newStats[sub], total: newStats[sub].total + 1 };
      setAttendance(newStats);

      await setDoc(doc(db, 'user_stats', user.uid), { subjects: newStats }, { merge: true });

      // 2. Update History
      const historyDoc = await getDoc(doc(db, 'attendance_history', user.uid));
      const historyData = historyDoc.exists() ? historyDoc.data().dates || {} : {};
      
      if (status === 'absent' || historyData[todayDate] === 'missed') {
        historyData[todayDate] = 'missed';
      } else {
        historyData[todayDate] = 'perfect';
      }

      await setDoc(doc(db, 'attendance_history', user.uid), { dates: historyData }, { merge: true });

      Alert.alert(
        status === 'present' ? 'Nice!' : 'Bunked!',
        status === 'present' ? `Marked present for ${sub}` : `You skipped ${sub}. Stats updated.`
      );
    } catch (error) {
      console.error("Mark Attendance Error:", error);
      Alert.alert("Error", "Could not sync attendance. Check your connection.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const calculateOverall = () => {
    let totalAttended = 0;
    let totalClasses = 0;
    Object.values(attendance).forEach((stat) => {
      totalAttended += stat.attended;
      totalClasses += stat.total;
    });
    return totalClasses === 0 ? 0 : totalAttended / totalClasses;
  };

  const overallPercent = calculateOverall();
  const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.welcomeText}>Hey, {userData?.name || 'User'}!</Text>
          <Text style={styles.branchText}>{userData?.branch} • Sem {userData?.semester}</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Monthly Progress Card */}
      <View style={styles.monthlyCard}>
        <View style={styles.monthlyInfo}>
          <Text style={styles.monthlyTitle}>This Month's Attendance</Text>
          <Text style={styles.monthlyMainText}>{monthlyStats.attended} Classes Attended</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${Math.min((monthlyStats.attended / monthlyStats.total) * 100, 100)}%` }]} />
          </View>
          <View style={styles.monthlyFooter}>
            <Text style={styles.monthlySubtext}>Total: {monthlyStats.total} Classes</Text>
            <Text style={styles.monthlySubtext}>Target: {monthlyStats.goal}%</Text>
          </View>
        </View>
        <View style={styles.percentageCircle}>
          <Text style={styles.circlePercent}>{(overallPercent * 100).toFixed(0)}%</Text>
          <Text style={styles.circleLabel}>Overall</Text>
        </View>
      </View>

      {/* Mass Bunk Banner */}
      <View style={[styles.massBunkBanner, isMassBunked && styles.massBunkBannerActive]}>
        <View style={styles.massBunkContent}>
          <Ionicons name={isMassBunked ? "people" : "people-outline"} size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.massBunkHeadline}>{massBunk.votes} people planning to skip</Text>
            <Text style={styles.massBunkSubheadline}>
              {isMassBunked ? "You are in the plan! Stay tuned." : "Join the movement for the 3rd lecture?"}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.joinBtn, isMassBunked && styles.joinBtnActive]} 
          onPress={handleMassBunkJoin}
          disabled={isMassBunked}
        >
          <Text style={[styles.joinBtnText, isMassBunked && styles.joinBtnTextActive]}>
            {isMassBunked ? "Joined" : "Count Me In"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Today's Schedule */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        <Text style={styles.dateText}>{todayFormatted}</Text>
      </View>

      <View style={styles.classList}>
        {todayClasses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No classes scheduled today</Text>
            <Text style={styles.emptySubText}>Enjoy your day off! 🎉</Text>
          </View>
        ) : (
          todayClasses.map((cls, index) => {
            const stats = attendance[cls.subject] || { attended: 0, total: 0 };
            const ifSkipPercent = stats.total > 0 ? (stats.attended) / (stats.total + 1) : 0;
            const isRisk = ifSkipPercent < 0.75;

            return (
              <View key={index} style={[styles.classCard, cls.marked ? styles.classCardMarked : undefined]}>
                <View style={styles.classTimeCol}>
                  <Text style={styles.classTimeText}>{cls.startTime}</Text>
                  <View style={styles.verticalLine} />
                  <Text style={styles.classTimeText}>{cls.endTime}</Text>
                </View>
                
                <View style={styles.classMainCol}>
                  <Text style={styles.classSubjectText}>{cls.subject}</Text>
                  <View style={styles.predictorRow}>
                    <Ionicons name="trending-down" size={14} color={isRisk ? "#FF3B30" : "#34C759"} />
                    <Text style={[styles.predictorText, { color: isRisk ? "#FF3B30" : "#34C759" }]}>
                      If skipped: {(ifSkipPercent * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.classActionCol}>
                  {cls.marked ? (
                    <View style={[styles.markedBadge, cls.marked === 'present' ? styles.presentBadge : styles.absentBadge]}>
                      <Ionicons 
                        name={cls.marked === 'present' ? "checkmark-circle" : "close-circle"} 
                        size={24} 
                        color="#fff" 
                      />
                    </View>
                  ) : (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity 
                        style={[styles.btnCircle, styles.btnPresent]} 
                        onPress={() => markAttendance(index, 'present')}
                      >
                        <Ionicons name="checkmark" size={20} color="#34C759" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.btnCircle, styles.btnAbsent]} 
                        onPress={() => markAttendance(index, 'absent')}
                      >
                        <Ionicons name="close" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width * 0.06,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 3,
  },
  welcomeText: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  branchText: {
    fontSize: width * 0.035,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
  },
  notifBtn: {
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 14,
  },
  monthlyCard: {
    backgroundColor: '#007AFF',
    margin: width * 0.04,
    padding: width * 0.05,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
  },
  monthlyInfo: {
    flex: 1,
  },
  monthlyTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: width * 0.03,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthlyMainText: {
    color: '#fff',
    fontSize: width * 0.05,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginVertical: 10,
    width: '90%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  monthlyFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  monthlySubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: width * 0.03,
    fontWeight: '500',
  },
  percentageCircle: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: (width * 0.2) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    marginLeft: 10,
  },
  circlePercent: {
    color: '#fff',
    fontSize: width * 0.05,
    fontWeight: 'bold',
  },
  circleLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: width * 0.025,
    fontWeight: 'bold',
  },
  massBunkBanner: {
    backgroundColor: '#5856D6',
    marginHorizontal: width * 0.04,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  massBunkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  massBunkHeadline: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: width * 0.035,
    flexShrink: 1,
  },
  massBunkSubheadline: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: width * 0.028,
    flexShrink: 1,
  },
  joinBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  joinBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  joinBtnText: {
    color: '#5856D6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  joinBtnTextActive: {
    color: '#fff',
  },
  massBunkBannerActive: {
    backgroundColor: '#34C759',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  dateText: {
    fontSize: width * 0.035,
    color: '#8E8E93',
  },
  classList: {
    paddingHorizontal: width * 0.04,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  classCardMarked: {
    opacity: 0.6,
    backgroundColor: '#F2F2F7',
  },
  classTimeCol: {
    width: width * 0.15,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F2F2F7',
    paddingRight: 8,
  },
  classTimeText: {
    fontSize: width * 0.028,
    color: '#8E8E93',
    fontWeight: 'bold',
  },
  verticalLine: {
    width: 2,
    height: 12,
    backgroundColor: '#007AFF',
    marginVertical: 4,
    borderRadius: 1,
  },
  classMainCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  classSubjectText: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  predictorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  predictorText: {
    fontSize: width * 0.03,
    fontWeight: '600',
  },
  classActionCol: {
    width: width * 0.22,
    alignItems: 'flex-end',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnCircle: {
    width: width * 0.09,
    height: width * 0.09,
    borderRadius: (width * 0.09) / 2,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPresent: {
    backgroundColor: '#E8F9EE',
  },
  btnAbsent: {
    backgroundColor: '#FFF1F0',
  },
  markedBadge: {
    width: width * 0.09,
    height: width * 0.09,
    borderRadius: (width * 0.09) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentBadge: {
    backgroundColor: '#34C759',
  },
  absentBadge: {
    backgroundColor: '#FF3B30',
  },
});
