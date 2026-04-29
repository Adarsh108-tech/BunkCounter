import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { read, utils } from 'xlsx';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/constants/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';

const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'IT'];
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default function TimetableScreen() {
  const [userRole, setUserRole] = useState<'admin' | 'student'>('admin'); // Defaulting to admin for UI demo
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [selectedSem, setSelectedSem] = useState('6');
  const [timetable, setTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'student');
        }
      }
    };
    fetchUserRole();
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [selectedBranch, selectedSem]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const timetableDoc = await getDoc(doc(db, 'timetables', `${selectedBranch}_${selectedSem}`));
      if (timetableDoc.exists()) {
        setTimetable(timetableDoc.data());
      } else {
        setTimetable({});
      }
    } catch (error) {
      console.error("Fetch Timetable Error:", error);
      setTimetable({});
    } finally {
      setLoading(false);
    }
  };

  const handleUploadExcel = async () => {
    if (userRole !== 'admin') return;
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        setUploading(true);
        const fileUri = result.assets[0].uri;
        
        // In a real browser environment, we'd read the file as an array buffer.
        // For Expo Go, we'll simulate the parsing result for this UI check.
        // If you were on a real device/native, you'd use react-native-fs or similar.
        
        const mockParsedData = {
          Monday: [
            { subject: 'Applied Physics', startTime: '09:00', endTime: '10:00', room: 'LH 101' },
            { subject: 'Engineering Math', startTime: '10:00', endTime: '11:00', room: 'LH 102' },
          ],
          Tuesday: [{ subject: 'Workshop', startTime: '09:00', endTime: '12:00', room: 'WS 1' }],
          Wednesday: [{ subject: 'Programming in C', startTime: '11:00', endTime: '01:00', room: 'Lab 2' }],
          Thursday: [{ subject: 'English', startTime: '02:00', endTime: '03:00', room: 'LH 101' }],
          Friday: [{ subject: 'Chemistry', startTime: '09:00', endTime: '11:00', room: 'Lab 1' }],
        };

        const docId = `${selectedBranch}_${selectedSem}`;
        await setDoc(doc(db, 'timetables', docId), mockParsedData);
        
        setTimetable(mockParsedData);
        Alert.alert('Admin Success', `Timetable for ${selectedBranch} Sem ${selectedSem} updated in Firestore!`);
        setUploading(false);
      }
    } catch (error) {
      setUploading(false);
      console.error("Upload Error:", error);
      Alert.alert('Error', 'Failed to upload timetable');
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <View style={styles.container}>
      {/* Selector Section */}
      <View style={styles.selectorSection}>
        <Text style={styles.selectorLabel}>Select Branch & Semester</Text>
        <View style={styles.row}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {BRANCHES.map(b => (
              <TouchableOpacity 
                key={b} 
                style={[styles.chip, selectedBranch === b && styles.chipActive]}
                onPress={() => setSelectedBranch(b)}
              >
                <Text style={[styles.chipText, selectedBranch === b && styles.chipTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.row}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {SEMESTERS.map(s => (
              <TouchableOpacity 
                key={s} 
                style={[styles.chip, selectedSem === s && styles.chipActive]}
                onPress={() => setSelectedSem(s)}
              >
                <Text style={[styles.chipText, selectedSem === s && styles.chipTextActive]}>Sem {s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Weekly Schedule</Text>
            <Text style={styles.subtitle}>{selectedBranch} - Semester {selectedSem}</Text>
          </View>
          {userRole === 'admin' && (
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={handleUploadExcel}
              disabled={uploading}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : Object.keys(timetable || {}).length > 0 ? (
          days.map((day) => (
            <View key={day} style={styles.daySection}>
              <Text style={styles.dayTitle}>{day}</Text>
              {timetable[day]?.map((slot: any, index: number) => (
                <View key={index} style={styles.slotCard}>
                  <View style={styles.timeInfo}>
                    <Text style={styles.timeText}>{slot.startTime}</Text>
                    <View style={styles.timeLine} />
                    <Text style={styles.timeText}>{slot.endTime}</Text>
                  </View>
                  <View style={styles.slotDetails}>
                    <Text style={styles.subjectText}>{slot.subject}</Text>
                    <Text style={styles.roomText}>{slot.room || 'Room TBD'}</Text>
                  </View>
                </View>
              )) || <Text style={styles.noClasses}>No classes scheduled</Text>}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No timetable found for this selection.</Text>
            {userRole === 'admin' ? (
              <TouchableOpacity style={styles.createBtn} onPress={handleUploadExcel}>
                <Text style={styles.createBtnText}>Upload New Timetable</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.emptySubtext}>Contact admin to upload.</Text>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  selectorSection: {
    backgroundColor: '#fff',
    padding: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  selectorLabel: {
    fontSize: width * 0.035,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    marginBottom: 10,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chipText: {
    fontSize: width * 0.035,
    color: '#8E8E93',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: width * 0.04,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: width * 0.035,
    color: '#007AFF',
    fontWeight: '700',
    marginTop: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  daySection: {
    marginBottom: 24,
  },
  dayTitle: {
    fontSize: width * 0.045,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    paddingLeft: 4,
  },
  slotCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
  },
  timeInfo: {
    width: width * 0.15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F2F2F7',
    paddingRight: 12,
  },
  timeText: {
    fontSize: width * 0.028,
    color: '#8E8E93',
    fontWeight: '700',
  },
  timeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#007AFF',
    marginVertical: 4,
    borderRadius: 1,
  },
  slotDetails: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  roomText: {
    fontSize: width * 0.032,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
  },
  noClasses: {
    fontSize: 14,
    color: '#C7C7CC',
    fontStyle: 'italic',
    paddingLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  createBtn: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
    textAlign: 'center',
  },
});
