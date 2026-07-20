sed -i '/const \[stats, setStats\] = useState/i \  const [showPendingModal, setShowPendingModal] = useState(false);' src/components/Dashboard.tsx
