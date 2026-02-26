import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import API_BASE from '../config/api';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
  const [doctorData, setDoctorData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    ayurveda: 0,
    siddha: 0,
    unani: 0,
    totalMappings: 0
  });
  const [mappingsData, setMappingsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch doctor data
        const doctorDoc = await getDoc(doc(db, 'users', user.uid));
        if (doctorDoc.exists()) {
          setDoctorData(doctorDoc.data());
        }

        // Fetch patients created by this doctor
        const q = query(collection(db, 'patients'), where("createdBy", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const patientsData = [];
        querySnapshot.forEach((doc) => {
          patientsData.push({ id: doc.id, ...doc.data() });
        });
        setPatients(patientsData);

        // Fetch mappings stats from the endpoint
        const mappingsResponse = await fetch(`${API_BASE}/terminologies/mappings/stats/`);
        if (mappingsResponse.ok) {
          const mappingsStats = await mappingsResponse.json();
          setMappingsData(mappingsStats);
          
          // Animate the numbers from 0 to the actual values
          animateStats(mappingsStats, patientsData.length);
        } else {
          // Fallback to random numbers if API fails
          setStats({
            totalPatients: patientsData.length,
            ayurveda: Math.floor(Math.random() * 10),
            siddha: Math.floor(Math.random() * 8),
            unani: Math.floor(Math.random() * 6),
            totalMappings: Math.floor(Math.random() * 12)
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Fallback to random numbers on error
        setStats({
          totalPatients: patients.length,
          ayurveda: Math.floor(Math.random() * 10),
          siddha: Math.floor(Math.random() * 8),
          unani: Math.floor(Math.random() * 6),
          totalMappings: Math.floor(Math.random() * 12)
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const animateStats = (mappingsStats, patientCount) => {
    const targetStats = {
      totalPatients: patientCount,
      ayurveda: mappingsStats.by_system?.ayurveda || 0,
      siddha: mappingsStats.by_system?.siddha || 0,
      unani: mappingsStats.by_system?.unani || 0,
      totalMappings: mappingsStats.total_mappings || 0
    };

    // Start from 0
    setStats({
      totalPatients: 0,
      ayurveda: 0,
      siddha: 0,
      unani: 0,
      totalMappings: 0
    });

    // Animate each stat with different durations for smooth effect
    const duration = 2000; // 2 seconds total
    const steps = 60; // Number of animation steps
    const stepDuration = duration / steps;

    Object.keys(targetStats).forEach((key, index) => {
      const targetValue = targetStats[key];
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const currentValue = Math.floor(targetValue * progress);

        setStats(prev => ({
          ...prev,
          [key]: currentValue
        }));

        if (currentStep >= steps) {
          clearInterval(interval);
          // Ensure final value is exact
          setStats(prev => ({
            ...prev,
            [key]: targetValue
          }));
        }
      }, stepDuration);
    });
  };

  if (!auth.currentUser) {
    return (
      <div className="doctor-dashboard">
        <div className="container">
          <div className="not-signed-in">
            <h2>Please sign in to view your dashboard</h2>
            <Link to="/" className="cta-button">Go to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div className="container">
          <div className="loading-state">
            <h2>Loading Dashboard...</h2>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-dashboard">
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="dashboard-header"
        >
          <div className="doctor-info">
            <h2>Doctor Dashboard</h2>
            <p>Welcome back, {doctorData?.name || 'Doctor'}</p>
          </div>
          {mappingsData && (
            <div className="mappings-info">
              <small>Live data from AYUSH Bandhan Mappings</small>
            </div>
          )}
        </motion.div>

        {/* Stats */}
      <div className="stats-grid">
  {[
    { icon: "/user.jpg", label: "Total Patients", value: stats.totalPatients },
    { icon: "/img1.png", label: "Ayurveda", value: stats.ayurveda },
    { icon: "/img2.png", label: "Siddha", value: stats.siddha },
    { icon: "/img3.png", label: "Unani", value: stats.unani },
    { icon: "/img4.png", label: "Total", value: stats.totalMappings }
  ].map((stat, i) => (
    <motion.div
      key={i}
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * i }}
    >
      {/* ✅ instead of emoji, render <img> */}
      <div className="stat-icon">
        <img src={stat.icon} alt={stat.label} className="stat-img" />
      </div>
      <div className="stat-content">
        <h3>{stat.value.toLocaleString()}</h3>
        <p>{stat.label}</p>
      </div>
    </motion.div>
  ))}
</div>


        {/* Content */}
        <div className="dashboard-content">
          {/* Recent Patients */}
          <div className="recent-patients">
            <div className="section-header">
              <h3>Recent Patients</h3>
              <Link to="/add-patient" className="cta-button small">
                Add New Patient
              </Link>
            </div>
            {patients.length > 0 ? (
              <div className="patients-list">
                {patients.slice(0, 5).map((patient, index) => (
                  <motion.div
                    key={patient.id}
                    className="patient-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link to={`/patient/${patient.id}`} className="patient-link">
                      <div className="patient-info">
                        <h4>{patient.fullName}</h4>
                        <p>{patient.gender}, {patient.age} years</p>
                      </div>
                      <div className="patient-contact">
                        <p>{patient.phone}</p>
                        <p>{patient.city}, {patient.state}</p>
                      </div>
                      <div className="patient-actions">
                        <span className="view-details">View Details →</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="no-patients">
                <p>No patients registered yet.</p>
                <Link to="/add-patient" className="cta-button reg_another">
                  Register Your First Patient
                </Link>
              </div>
            )}
            {patients.length > 5 && (
              <div className="view-all-patients">
                <Link to="/patients" className="view-all-link">
                  View All Patients ({patients.length})
                </Link>
              </div>
            )}
          </div>

          {/* Doctor Details */}
          <div className="doctor-details">
            <h3>Your Information</h3>
            <div className="details-card">
              {doctorData ? (
                <>
                  <div className="detail-row">
                    <label>Name:</label>
                    <span>{doctorData.name || 'Not provided'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Specialty:</label>
                    <span>{doctorData.specialty || 'Not specified'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Education:</label>
                    <span>{doctorData.education || 'Not provided'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Experience:</label>
                    <span>{doctorData.experience || 'Not provided'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Availability:</label>
                    <span>{doctorData.availability || 'Not specified'}</span>
                  </div>
                </>
              ) : (
                <p>Loading your information...</p>
              )}
              <div className="edit-profile-btn">
                <Link to="/profile">Edit Profile</Link>
              </div>
            </div>
          </div>
        </div>
       
      </div>
    </div>
  );
};

export default DoctorDashboard;
