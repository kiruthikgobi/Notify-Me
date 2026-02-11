
import { Vehicle, ComplianceRecord } from '../types';

export const exportToExcel = (vehicles: Vehicle[], records: ComplianceRecord[], filename: string) => {
  // Define CSV Headers
  const headers = ['Registration Number', 'Make', 'Model', 'Year', 'Compliance Type', 'Expiry Date', 'Status', 'Last Renewed'];
  
  const now = new Date();
  
  // Map data to rows
  const rows = records.map(record => {
    const vehicle = vehicles.find(v => v.id === record.vehicleId);
    if (!vehicle) return null;
    
    const expiryDate = record.expiryDate ? new Date(record.expiryDate) : null;
    let status = 'Missing';
    if (expiryDate) {
      status = expiryDate < now ? 'EXPIRED' : 'VALID';
    }

    return [
      vehicle.registrationNumber,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      record.type,
      record.expiryDate || 'N/A',
      status,
      record.lastRenewedDate || 'N/A'
    ];
  }).filter(row => row !== null) as string[][];

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
