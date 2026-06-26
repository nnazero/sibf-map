import { Booth } from './pathfinding';

export interface FacilityItem {
  id: string; label: string;
  type: 'toilet' | 'info' | 'escalator' | 'gate';
  hall: 'A' | 'B';
  location: { x: number; y: number };
  emoji: string;
}

export const FACILITIES: FacilityItem[] = [
  { id:'toilet-a1', label:'화장실 A-1',    type:'toilet',    hall:'A', location:{x:336,  y:958 }, emoji:'🚻' },
  { id:'toilet-a2', label:'화장실 A-2',    type:'toilet',    hall:'A', location:{x:810,  y:1812}, emoji:'🚻' },
  { id:'toilet-a3', label:'화장실 A-3',    type:'toilet',    hall:'A', location:{x:1126, y:1812}, emoji:'🚻' },
  { id:'toilet-a4', label:'화장실 A-4',    type:'toilet',    hall:'A', location:{x:1612, y:958 }, emoji:'🚻' },
  { id:'toilet-b1', label:'화장실 B-1',    type:'toilet',    hall:'B', location:{x:1822, y:594 }, emoji:'🚻' },
  { id:'toilet-b2', label:'화장실 B-2',    type:'toilet',    hall:'B', location:{x:1820, y:158 }, emoji:'🚻' },
  { id:'info-a1',   label:'인포·티켓 A홀',  type:'info',      hall:'A', location:{x:1723, y:1887}, emoji:'ℹ️' },
  { id:'info-b1',   label:'인포·티켓 B1홀', type:'info',      hall:'B', location:{x:1896, y:594 }, emoji:'ℹ️' },
  { id:'gate-a1-out', label:'A홀 출구',    type:'gate',      hall:'A', location:{x:492,  y:1918}, emoji:'🚪' },
  { id:'gate-a1-in',  label:'A홀 입구',    type:'gate',      hall:'A', location:{x:1403, y:1918}, emoji:'🚶' },
  { id:'gate-b1',     label:'B1홀 출입구', type:'gate',      hall:'B', location:{x:1836, y:422 }, emoji:'🏛️' },
  { id:'esc-ab-1',    label:'에스컬레이터 1', type:'escalator', hall:'A', location:{x:1084, y:925}, emoji:'🪜' },
  { id:'esc-ab-2',    label:'에스컬레이터 2', type:'escalator', hall:'A', location:{x:1396, y:925}, emoji:'🪜' },
];

export const facilityToBooth = (fac: FacilityItem): Booth => ({
  id: fac.id,
  booth_number: fac.hall === 'A' ? `A_${fac.id}` : `B_${fac.id}`,
  gate: fac.hall === 'A' ? 'A 출입구' : 'B1 출입구',
  location: fac.location,
  size: { w: 40, h: 40 },
  publisher_name: fac.label,
  category: fac.type,
});

export const facilityTypeLabel = (type: FacilityItem['type']): string => ({
  toilet: '화장실',
  info: '인포·티켓 데스크',
  gate: '출입구',
  escalator: '에스컬레이터',
}[type]);