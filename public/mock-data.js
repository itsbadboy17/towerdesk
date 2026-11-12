export const towers = [
  {
    id: 'tower-1',
    name: 'Main Tower (Central)',
    location: 'Central Office',
    devices: [
      {
        id: 'device-1',
        ip: '192.168.1.1',
        type: 'MikroTik',
        status: 'online',
        clients: 25,
        memory: '85%',
        cpu: '45%',
        interfaces: [
          { name: 'ether1', type: 'ethernet', status: 'up', speed: '100Mbps' },
          { name: 'ether2', type: 'ethernet', status: 'up', speed: '100Mbps' },
          { name: 'ether3', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-001', name: 'Client 1', ip: '192.168.1.10', type: 'WiFi', speed: 5, uptime: '1h' },
          { id: 'client-002', name: 'Client 2', ip: '192.168.1.11', type: 'WiFi', speed: 3, uptime: '1h' },
          { id: 'client-003', name: 'Client 3', ip: '192.168.1.12', type: 'WiFi', speed: 8, uptime: '1h' },
          { id: 'client-004', name: 'Client 4', ip: '192.168.1.13', type: 'WiFi', speed: 6, uptime: '1h' },
          { id: 'client-005', name: 'Client 5', ip: '192.168.1.14', type: 'WiFi', speed: 4, uptime: '1h' },
          { id: 'client-006', name: 'Client 6', ip: '192.168.1.15', type: 'WiFi', speed: 7, uptime: '1h' },
          { id: 'client-007', name: 'Client 7', ip: '192.168.1.16', type: 'WiFi', speed: 2, uptime: '1h' },
          { id: 'client-008', name: 'Client 8', ip: '192.168.1.17', type: 'WiFi', speed: 9, uptime: '1h' },
          { id: 'client-009', name: 'Client 9', ip: '192.168.1.18', type: 'WiFi', speed: 5, uptime: '1h' },
          { id: 'client-010', name: 'Client 10', ip: '192.168.1.19', type: 'WiFi', speed: 3, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:30:00Z'
      },
      {
        id: 'device-2',
        ip: '192.168.1.2',
        type: 'Cisco',
        status: 'online',
        clients: 18,
        memory: '75%',
        cpu: '35%',
        interfaces: [
          { name: 'eth0', type: 'ethernet', status: 'up', speed: '100Mbps' },
          { name: 'eth1', type: 'ethernet', status: 'up', speed: '100Mbps' },
          { name: 'eth2', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-011', name: 'Client 11', ip: '192.168.1.20', type: 'Ethernet', speed: 4, uptime: '1h' },
          { id: 'client-012', name: 'Client 12', ip: '192.168.1.21', type: 'Ethernet', speed: 6, uptime: '1h' },
          { id: 'client-013', name: 'Client 13', ip: '192.168.1.22', type: 'Ethernet', speed: 2, uptime: '1h' },
          { id: 'client-014', name: 'Client 14', ip: '192.168.1.23', type: 'Ethernet', speed: 5, uptime: '1h' },
          { id: 'client-015', name: 'Client 15', ip: '192.168.1.24', type: 'Ethernet', speed: 7, uptime: '1h' },
          { id: 'client-016', name: 'Client 16', ip: '192.168.1.25', type: 'Ethernet', speed: 3, uptime: '1h' },
          { id: 'client-017', name: 'Client 17', ip: '192.168.1.26', type: 'Ethernet', speed: 8, uptime: '1h' },
          { id: 'client-018', name: 'Client 18', ip: '192.168.1.27', type: 'Ethernet', speed: 1, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:35:00Z'
      },
      {
        id: 'device-5',
        ip: '192.168.1.5',
        type: 'MikroTik',
        status: 'online',
        clients: 15,
        memory: '82%',
        cpu: '42%',
        interfaces: [
          { name: 'ether1', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-101', name: 'Client 101', ip: '192.168.1.100', type: 'WiFi', speed: 5, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:36:00Z'
      },
      {
        id: 'device-6',
        ip: '192.168.1.6',
        type: 'Cisco',
        status: 'online',
        clients: 9,
        memory: '70%',
        cpu: '30%',
        interfaces: [
          { name: 'eth0', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-102', name: 'Client 102', ip: '192.168.1.101', type: 'Ethernet', speed: 4, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:37:00Z'
      },
      {
        id: 'device-7',
        ip: '192.168.1.7',
        type: 'UBNT',
        status: 'online',
        clients: 11,
        memory: '78%',
        cpu: '48%',
        interfaces: [
          { name: 'Wan', type: 'wlan', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-103', name: 'Client 103', ip: '192.168.1.102', type: 'WiFi', speed: 6, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:38:00Z'
      },
      {
        id: 'device-8',
        ip: '192.168.1.8',
        type: 'Mimosa',
        status: 'online',
        clients: 7,
        memory: '88%',
        cpu: '55%',
        interfaces: [
          { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-104', name: 'Client 104', ip: '192.168.1.103', type: 'WiFi', speed: 7, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:39:00Z'
      }
    ]
  },
  {
    id: 'tower-2',
    name: 'West Facility',
    location: 'West Building',
    devices: [
      {
        id: 'device-3',
        ip: '192.168.1.3',
        type: 'UBNT',
        status: 'online',
        clients: 32,
        memory: '80%',
        cpu: '50%',
        interfaces: [
          { name: 'Wan', type: 'wlan', status: 'up', speed: '100Mbps' },
          { name: 'Wireless', type: 'wlan', status: 'up', speed: '100Mbps' },
          { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-019', name: 'Client 19', ip: '192.168.1.30', type: 'WiFi', speed: 6, uptime: '1h' },
          { id: 'client-020', name: 'Client 20', ip: '192.168.1.31', type: 'WiFi', speed: 4, uptime: '1h' },
          { id: 'client-021', name: 'Client 21', ip: '192.168.1.32', type: 'WiFi', speed: 8, uptime: '1h' },
          { id: 'client-022', name: 'Client 22', ip: '192.168.1.33', type: 'WiFi', speed: 3, uptime: '1h' },
          { id: 'client-023', name: 'Client 23', ip: '192.168.1.34', type: 'WiFi', speed: 7, uptime: '1h' },
          { id: 'client-024', name: 'Client 24', ip: '192.168.1.35', type: 'WiFi', speed: 5, uptime: '1h' },
          { id: 'client-025', name: 'Client 25', ip: '192.168.1.36', type: 'WiFi', speed: 9, uptime: '1h' },
          { id: 'client-026', name: 'Client 26', ip: '192.168.1.37', type: 'WiFi', speed: 2, uptime: '1h' },
          { id: 'client-027', name: 'Client 27', ip: '192.168.1.38', type: 'WiFi', speed: 4, uptime: '1h' },
          { id: 'client-028', name: 'Client 28', ip: '192.168.1.39', type: 'WiFi', speed: 6, uptime: '1h' },
          { id: 'client-029', name: 'Client 29', ip: '192.168.1.40', type: 'WiFi', speed: 8, uptime: '1h' },
          { id: 'client-030', name: 'Client 30', ip: '192.168.1.41', type: 'WiFi', speed: 3, uptime: '1h' },
          { id: 'client-031', name: 'Client 31', ip: '192.168.1.42', type: 'WiFi', speed: 7, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:40:00Z'
      },
      {
        id: 'device-4',
        ip: '192.168.1.4',
        type: 'Mimosa',
        status: 'online',
        clients: 14,
        memory: '90%',
        cpu: '60%',
        interfaces: [
          { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps' },
          { name: 'Wireless', type: 'wlan', status: 'up', speed: '50Mbps' }
        ],
        clients: [
          { id: 'client-032', name: 'Client 32', ip: '192.168.1.43', type: 'WiFi', speed: 3, uptime: '1h' },
          { id: 'client-033', name: 'Client 33', ip: '192.168.1.44', type: 'WiFi', speed: 5, uptime: '1h' },
          { id: 'client-034', name: 'Client 34', ip: '192.168.1.45', type: 'WiFi', speed: 7, uptime: '1h' },
          { id: 'client-035', name: 'Client 35', ip: '192.168.1.46', type: 'WiFi', speed: 2, uptime: '1h' },
          { id: 'client-036', name: 'Client 36', ip: '192.168.1.47', type: 'WiFi', speed: 4, uptime: '1h' },
          { id: 'client-037', name: 'Client 37', ip: '192.168.1.48', type: 'WiFi', speed: 6, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:45:00Z'
      },
      {
        id: 'device-9',
        ip: '192.168.1.9',
        type: 'MikroTik',
        status: 'online',
        clients: 13,
        memory: '81%',
        cpu: '44%',
        interfaces: [
          { name: 'ether1', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-105', name: 'Client 105', ip: '192.168.1.104', type: 'WiFi', speed: 4, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:41:00Z'
      },
      {
        id: 'device-10',
        ip: '192.168.1.10',
        type: 'Cisco',
        status: 'online',
        clients: 10,
        memory: '72%',
        cpu: '33%',
        interfaces: [
          { name: 'eth0', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-106', name: 'Client 106', ip: '192.168.1.105', type: 'Ethernet', speed: 5, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:42:00Z'
      },
      {
        id: 'device-11',
        ip: '192.168.1.11',
        type: 'UBNT',
        status: 'online',
        clients: 16,
        memory: '79%',
        cpu: '52%',
        interfaces: [
          { name: 'Wan', type: 'wlan', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-107', name: 'Client 107', ip: '192.168.1.106', type: 'WiFi', speed: 8, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:43:00Z'
      },
      {
        id: 'device-12',
        ip: '192.168.1.12',
        type: 'Mimosa',
        status: 'online',
        clients: 8,
        memory: '86%',
        cpu: '58%',
        interfaces: [
          { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps' }
        ],
        clients: [
          { id: 'client-108', name: 'Client 108', ip: '192.168.1.107', type: 'WiFi', speed: 9, uptime: '1h' }
        ],
        lastSeen: '2026-10-30T10:44:00Z'
      }
    ]
  }
];

export const subscribers = [
  {
    id: 'sub-001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-29T14:30:00Z',
    devices: [
      { id: 'dev-1', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.10' },
      { id: 'dev-2', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.11' }
    ]
  },
  {
    id: 'sub-002',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-29T15:15:00Z',
    devices: [
      { id: 'dev-3', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.12' },
      { id: 'dev-4', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.13' }
    ]
  },
  {
    id: 'sub-003',
    name: 'Robert Johnson',
    email: 'robert.johnson@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-29T16:00:00Z',
    devices: [
      { id: 'dev-5', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.14' },
      { id: 'dev-6', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.15' }
    ]
  },
  {
    id: 'sub-004',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    plan: 'Basic',
    balance: 80,
    status: 'Active',
    lastLogin: '2026-10-29T17:20:00Z',
    devices: [
      { id: 'dev-7', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.16' },
      { id: 'dev-8', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.17' }
    ]
  },
  {
    id: 'sub-005',
    name: 'Michael Brown',
    email: 'michael.brown@example.com',
    plan: 'Standard',
    balance: 200,
    status: 'Active',
    lastLogin: '2026-10-29T18:10:00Z',
    devices: [
      { id: 'dev-9', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.18' },
      { id: 'dev-10', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.19' }
    ]
  },
  {
    id: 'sub-006',
    name: 'Sophia Martinez',
    email: 'sophia.martinez@example.com',
    plan: 'Premium',
    balance: 450,
    status: 'Active',
    lastLogin: '2026-10-29T19:05:00Z',
    devices: [
      { id: 'dev-11', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.20' },
      { id: 'dev-12', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.21' }
    ]
  },
  {
    id: 'sub-007',
    name: 'David Wilson',
    email: 'david.wilson@example.com',
    plan: 'Basic',
    balance: 100,
    status: 'Active',
    lastLogin: '2026-10-29T20:15:00Z',
    devices: [
      { id: 'dev-13', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.22' }
    ]
  },
  {
    id: 'sub-008',
    name: 'Jennifer Taylor',
    email: 'jennifer.taylor@example.com',
    plan: 'Standard',
    balance: 250,
    status: 'Active',
    lastLogin: '2026-10-29T21:00:00Z',
    devices: [
      { id: 'dev-14', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.23' },
      { id: 'dev-15', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.24' }
    ]
  },
  {
    id: 'sub-009',
    name: 'Christopher Anderson',
    email: 'christopher.anderson@example.com',
    plan: 'Premium',
    balance: 500,
    status: 'Active',
    lastLogin: '2026-10-29T22:00:00Z',
    devices: [
      { id: 'dev-16', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.25' },
      { id: 'dev-17', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.26' },
      { id: 'dev-18', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.27' }
    ]
  },
  {
    id: 'sub-010',
    name: 'Rachel Garcia',
    email: 'rachel.garcia@example.com',
    plan: 'Basic',
    balance: 75,
    status: 'Active',
    lastLogin: '2026-10-29T23:00:00Z',
    devices: [
      { id: 'dev-19', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.28' }
    ]
  },
  {
    id: 'sub-011',
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T08:00:00Z',
    devices: [
      { id: 'dev-20', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.30' }
    ]
  },
  {
    id: 'sub-012',
    name: 'Brian Smith',
    email: 'brian.smith@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T08:05:00Z',
    devices: [
      { id: 'dev-21', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.31' },
      { id: 'dev-22', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.32' }
    ]
  },
  {
    id: 'sub-013',
    name: 'Carla Davis',
    email: 'carla.davis@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T08:10:00Z',
    devices: [
      { id: 'dev-23', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.33' },
      { id: 'dev-24', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.34' }
    ]
  },
  {
    id: 'sub-014',
    name: 'Daniel Wilson',
    email: 'daniel.wilson@example.com',
    plan: 'Basic',
    balance: 60,
    status: 'Active',
    lastLogin: '2026-10-30T08:15:00Z',
    devices: [
      { id: 'dev-25', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.35' }
    ]
  },
  {
    id: 'sub-015',
    name: 'Emma Moore',
    email: 'emma.moore@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T08:20:00Z',
    devices: [
      { id: 'dev-26', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.36' },
      { id: 'dev-27', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.37' }
    ]
  },
  {
    id: 'sub-016',
    name: 'Frank Taylor',
    email: 'frank.taylor@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T08:25:00Z',
    devices: [
      { id: 'dev-28', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.38' },
      { id: 'dev-29', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.39' }
    ]
  },
  {
    id: 'sub-017',
    name: 'Grace Anderson',
    email: 'grace.anderson@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T08:30:00Z',
    devices: [
      { id: 'dev-30', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.40' }
    ]
  },
  {
    id: 'sub-018',
    name: 'Henry Thomas',
    email: 'henry.thomas@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T08:35:00Z',
    devices: [
      { id: 'dev-31', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.41' },
      { id: 'dev-32', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.42' }
    ]
  },
  {
    id: 'sub-019',
    name: 'Irene Jackson',
    email: 'irene.jackson@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T08:40:00Z',
    devices: [
      { id: 'dev-33', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.43' },
      { id: 'dev-34', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.44' }
    ]
  },
  {
    id: 'sub-020',
    name: 'Jack White',
    email: 'jack.white@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T08:45:00Z',
    devices: [
      { id: 'dev-35', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.45' }
    ]
  },
  {
    id: 'sub-021',
    name: 'Karen White',
    email: 'karen.white@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T09:00:00Z',
    devices: [
      { id: 'dev-36', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.46' }
    ]
  },
  {
    id: 'sub-022',
    name: 'Leo Harris',
    email: 'leo.harris@example.com',
    plan: 'Basic',
    balance: 40,
    status: 'Active',
    lastLogin: '2026-10-30T09:05:00Z',
    devices: [
      { id: 'dev-37', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.47' }
    ]
  },
  {
    id: 'sub-023',
    name: 'Mona Martin',
    email: 'mona.martin@example.com',
    plan: 'Premium',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T09:10:00Z',
    devices: [
      { id: 'dev-38', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.48' },
      { id: 'dev-39', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.49' }
    ]
  },
  {
    id: 'sub-024',
    name: 'Nathan Thompson',
    email: 'nathan.thompson@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T09:15:00Z',
    devices: [
      { id: 'dev-40', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.50' }
    ]
  },
  {
    id: 'sub-025',
    name: 'Olivia Garcia',
    email: 'olivia.garcia@example.com',
    plan: 'Basic',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T09:20:00Z',
    devices: [
      { id: 'dev-41', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.51' }
    ]
  },
  {
    id: 'sub-026',
    name: 'Peter Rodriguez',
    email: 'peter.rodriguez@example.com',
    plan: 'Premium',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T09:25:00Z',
    devices: [
      { id: 'dev-42', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.52' },
      { id: 'dev-43', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.53' }
    ]
  },
  {
    id: 'sub-027',
    name: 'Quinn Lee',
    email: 'quinn.lee@example.com',
    plan: 'Basic',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T09:30:00Z',
    devices: [
      { id: 'dev-44', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.54' }
    ]
  },
  {
    id: 'sub-028',
    name: 'Rachel Walker',
    email: 'rachel.walker@example.com',
    plan: 'Standard',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T09:35:00Z',
    devices: [
      { id: 'dev-45', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.55' },
      { id: 'dev-46', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.56' }
    ]
  },
  {
    id: 'sub-029',
    name: 'Sam Hall',
    email: 'sam.hall@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T09:40:00Z',
    devices: [
      { id: 'dev-47', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.57' }
    ]
  },
  {
    id: 'sub-030',
    name: 'Tina Allen',
    email: 'tina.allen@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T09:45:00Z',
    devices: [
      { id: 'dev-48', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.58' },
      { id: 'dev-49', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.59' }
    ]
  },
  {
    id: 'sub-031',
    name: 'Uma Young',
    email: 'uma.young@example.com',
    plan: 'Standard',
    balance: 165,
    status: 'Active',
    lastLogin: '2026-10-30T09:50:00Z',
    devices: [
      { id: 'dev-50', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.60' }
    ]
  },
  {
    id: 'sub-032',
    name: 'Victor King',
    email: 'victor.king@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T09:55:00Z',
    devices: [
      { id: 'dev-51', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.61' }
    ]
  },
  {
    id: 'sub-033',
    name: 'Wanda Wright',
    email: 'wanda.wright@example.com',
    plan: 'Premium',
    balance: 410,
    status: 'Active',
    lastLogin: '2026-10-30T10:00:00Z',
    devices: [
      { id: 'dev-52', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.62' },
      { id: 'dev-53', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.63' }
    ]
  },
  {
    id: 'sub-034',
    name: 'Xander Scott',
    email: 'xander.scott@example.com',
    plan: 'Standard',
    balance: 158,
    status: 'Active',
    lastLogin: '2026-10-30T10:05:00Z',
    devices: [
      { id: 'dev-54', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.64' },
      { id: 'dev-55', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.65' }
    ]
  },
  {
    id: 'sub-035',
    name: 'Yolanda Green',
    email: 'yolanda.green@example.com',
    plan: 'Basic',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T10:10:00Z',
    devices: [
      { id: 'dev-56', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.66' }
    ]
  },
  {
    id: 'sub-036',
    name: 'Zachary Baker',
    email: 'zachary.baker@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T10:15:00Z',
    devices: [
      { id: 'dev-57', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.67' },
      { id: 'dev-58', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.68' }
    ]
  },
  {
    id: 'sub-037',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T08:51:00Z',
    devices: [
      { id: 'dev-137', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.67' }
    ]
  },
  {
    id: 'sub-038',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T08:54:00Z',
    devices: [
      { id: 'dev-138', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.68' }
    ]
  },
  {
    id: 'sub-039',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T08:57:00Z',
    devices: [
      { id: 'dev-139', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.69' }
    ]
  },
  {
    id: 'sub-040',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T08:00:00Z',
    devices: [
      { id: 'dev-140', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.70' }
    ]
  },
  {
    id: 'sub-041',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T08:03:00Z',
    devices: [
      { id: 'dev-141', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.71' }
    ]
  },
  {
    id: 'sub-042',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T08:06:00Z',
    devices: [
      { id: 'dev-142', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.72' }
    ]
  },
  {
    id: 'sub-043',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T08:09:00Z',
    devices: [
      { id: 'dev-143', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.73' }
    ]
  },
  {
    id: 'sub-044',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T08:12:00Z',
    devices: [
      { id: 'dev-144', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.74' }
    ]
  },
  {
    id: 'sub-045',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T08:15:00Z',
    devices: [
      { id: 'dev-145', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.75' }
    ]
  },
  {
    id: 'sub-046',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T08:18:00Z',
    devices: [
      { id: 'dev-146', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.76' }
    ]
  },
  {
    id: 'sub-047',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T08:21:00Z',
    devices: [
      { id: 'dev-147', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.77' }
    ]
  },
  {
    id: 'sub-048',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T08:24:00Z',
    devices: [
      { id: 'dev-148', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.78' }
    ]
  },
  {
    id: 'sub-049',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T08:27:00Z',
    devices: [
      { id: 'dev-149', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.79' }
    ]
  },
  {
    id: 'sub-050',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T08:30:00Z',
    devices: [
      { id: 'dev-150', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.80' }
    ]
  },
  {
    id: 'sub-051',
    name: 'Margaret Thomas',
    email: 'margaret.thomas@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T08:33:00Z',
    devices: [
      { id: 'dev-151', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.81' }
    ]
  },
  {
    id: 'sub-052',
    name: 'Robert Lee',
    email: 'robert.lee@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T08:36:00Z',
    devices: [
      { id: 'dev-152', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.82' }
    ]
  },
  {
    id: 'sub-053',
    name: 'Barbara Sanchez',
    email: 'barbara.sanchez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T08:39:00Z',
    devices: [
      { id: 'dev-153', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.83' }
    ]
  },
  {
    id: 'sub-054',
    name: 'Charles Smith',
    email: 'charles.smith@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T08:42:00Z',
    devices: [
      { id: 'dev-154', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.84' }
    ]
  },
  {
    id: 'sub-055',
    name: 'Betty Garcia',
    email: 'betty.garcia@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T08:45:00Z',
    devices: [
      { id: 'dev-155', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.85' }
    ]
  },
  {
    id: 'sub-056',
    name: 'John Hernandez',
    email: 'john.hernandez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T08:48:00Z',
    devices: [
      { id: 'dev-156', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.86' }
    ]
  },
  {
    id: 'sub-057',
    name: 'Elizabeth Thomas',
    email: 'elizabeth.thomas@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T08:51:00Z',
    devices: [
      { id: 'dev-157', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.87' }
    ]
  },
  {
    id: 'sub-058',
    name: 'Thomas Lee',
    email: 'thomas.lee@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T08:54:00Z',
    devices: [
      { id: 'dev-158', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.88' }
    ]
  },
  {
    id: 'sub-059',
    name: 'Lisa Sanchez',
    email: 'lisa.sanchez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T08:57:00Z',
    devices: [
      { id: 'dev-159', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.89' }
    ]
  },
  {
    id: 'sub-060',
    name: 'James Smith',
    email: 'james.smith@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T09:00:00Z',
    devices: [
      { id: 'dev-100', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.90' }
    ]
  },
  {
    id: 'sub-061',
    name: 'Linda Garcia',
    email: 'linda.garcia@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T09:03:00Z',
    devices: [
      { id: 'dev-101', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.91' }
    ]
  },
  {
    id: 'sub-062',
    name: 'Joseph Hernandez',
    email: 'joseph.hernandez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T09:06:00Z',
    devices: [
      { id: 'dev-102', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.92' }
    ]
  },
  {
    id: 'sub-063',
    name: 'Nancy Thomas',
    email: 'nancy.thomas@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T09:09:00Z',
    devices: [
      { id: 'dev-103', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.93' }
    ]
  },
  {
    id: 'sub-064',
    name: 'Mark Lee',
    email: 'mark.lee@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T09:12:00Z',
    devices: [
      { id: 'dev-104', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.94' }
    ]
  },
  {
    id: 'sub-065',
    name: 'Jennifer Sanchez',
    email: 'jennifer.sanchez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T09:15:00Z',
    devices: [
      { id: 'dev-105', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.95' }
    ]
  },
  {
    id: 'sub-066',
    name: 'Richard Smith',
    email: 'richard.smith@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T09:18:00Z',
    devices: [
      { id: 'dev-106', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.96' }
    ]
  },
  {
    id: 'sub-067',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T09:21:00Z',
    devices: [
      { id: 'dev-107', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.97' }
    ]
  },
  {
    id: 'sub-068',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T09:24:00Z',
    devices: [
      { id: 'dev-108', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.98' }
    ]
  },
  {
    id: 'sub-069',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T09:27:00Z',
    devices: [
      { id: 'dev-109', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.99' }
    ]
  },
  {
    id: 'sub-070',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T09:30:00Z',
    devices: [
      { id: 'dev-110', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.100' }
    ]
  },
  {
    id: 'sub-071',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T09:33:00Z',
    devices: [
      { id: 'dev-111', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.101' }
    ]
  },
  {
    id: 'sub-072',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T09:36:00Z',
    devices: [
      { id: 'dev-112', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.102' }
    ]
  },
  {
    id: 'sub-073',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T09:39:00Z',
    devices: [
      { id: 'dev-113', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.103' }
    ]
  },
  {
    id: 'sub-074',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T09:42:00Z',
    devices: [
      { id: 'dev-114', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.104' }
    ]
  },
  {
    id: 'sub-075',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T09:45:00Z',
    devices: [
      { id: 'dev-115', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.105' }
    ]
  },
  {
    id: 'sub-076',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T09:48:00Z',
    devices: [
      { id: 'dev-116', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.106' }
    ]
  },
  {
    id: 'sub-077',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T09:51:00Z',
    devices: [
      { id: 'dev-117', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.107' }
    ]
  },
  {
    id: 'sub-078',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T09:54:00Z',
    devices: [
      { id: 'dev-118', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.108' }
    ]
  },
  {
    id: 'sub-079',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T09:57:00Z',
    devices: [
      { id: 'dev-119', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.109' }
    ]
  },
  {
    id: 'sub-080',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T09:00:00Z',
    devices: [
      { id: 'dev-120', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.110' }
    ]
  },
  {
    id: 'sub-081',
    name: 'Margaret Thomas',
    email: 'margaret.thomas@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T09:03:00Z',
    devices: [
      { id: 'dev-121', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.111' }
    ]
  },
  {
    id: 'sub-082',
    name: 'Robert Lee',
    email: 'robert.lee@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T09:06:00Z',
    devices: [
      { id: 'dev-122', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.112' }
    ]
  },
  {
    id: 'sub-083',
    name: 'Barbara Sanchez',
    email: 'barbara.sanchez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T09:09:00Z',
    devices: [
      { id: 'dev-123', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.113' }
    ]
  },
  {
    id: 'sub-084',
    name: 'Charles Smith',
    email: 'charles.smith@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T09:12:00Z',
    devices: [
      { id: 'dev-124', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.114' }
    ]
  },
  {
    id: 'sub-085',
    name: 'Betty Garcia',
    email: 'betty.garcia@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T09:15:00Z',
    devices: [
      { id: 'dev-125', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.115' }
    ]
  },
  {
    id: 'sub-086',
    name: 'John Hernandez',
    email: 'john.hernandez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T09:18:00Z',
    devices: [
      { id: 'dev-126', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.116' }
    ]
  },
  {
    id: 'sub-087',
    name: 'Elizabeth Thomas',
    email: 'elizabeth.thomas@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T09:21:00Z',
    devices: [
      { id: 'dev-127', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.117' }
    ]
  },
  {
    id: 'sub-088',
    name: 'Thomas Lee',
    email: 'thomas.lee@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T09:24:00Z',
    devices: [
      { id: 'dev-128', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.118' }
    ]
  },
  {
    id: 'sub-089',
    name: 'Lisa Sanchez',
    email: 'lisa.sanchez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T09:27:00Z',
    devices: [
      { id: 'dev-129', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.119' }
    ]
  },
  {
    id: 'sub-090',
    name: 'James Smith',
    email: 'james.smith@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T09:30:00Z',
    devices: [
      { id: 'dev-130', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.120' }
    ]
  },
  {
    id: 'sub-091',
    name: 'Linda Garcia',
    email: 'linda.garcia@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T09:33:00Z',
    devices: [
      { id: 'dev-131', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.121' }
    ]
  },
  {
    id: 'sub-092',
    name: 'Joseph Hernandez',
    email: 'joseph.hernandez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T09:36:00Z',
    devices: [
      { id: 'dev-132', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.122' }
    ]
  },
  {
    id: 'sub-093',
    name: 'Nancy Thomas',
    email: 'nancy.thomas@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T09:39:00Z',
    devices: [
      { id: 'dev-133', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.123' }
    ]
  },
  {
    id: 'sub-094',
    name: 'Mark Lee',
    email: 'mark.lee@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T09:42:00Z',
    devices: [
      { id: 'dev-134', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.124' }
    ]
  },
  {
    id: 'sub-095',
    name: 'Jennifer Sanchez',
    email: 'jennifer.sanchez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T09:45:00Z',
    devices: [
      { id: 'dev-135', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.125' }
    ]
  },
  {
    id: 'sub-096',
    name: 'Richard Smith',
    email: 'richard.smith@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T09:48:00Z',
    devices: [
      { id: 'dev-136', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.126' }
    ]
  },
  {
    id: 'sub-097',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T09:51:00Z',
    devices: [
      { id: 'dev-137', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.127' }
    ]
  },
  {
    id: 'sub-098',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T09:54:00Z',
    devices: [
      { id: 'dev-138', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.128' }
    ]
  },
  {
    id: 'sub-099',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T09:57:00Z',
    devices: [
      { id: 'dev-139', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.129' }
    ]
  },
  {
    id: 'sub-100',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T09:00:00Z',
    devices: [
      { id: 'dev-140', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.130' }
    ]
  },
  {
    id: 'sub-101',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T09:03:00Z',
    devices: [
      { id: 'dev-141', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.131' }
    ]
  },
  {
    id: 'sub-102',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T09:06:00Z',
    devices: [
      { id: 'dev-142', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.132' }
    ]
  },
  {
    id: 'sub-103',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T09:09:00Z',
    devices: [
      { id: 'dev-143', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.133' }
    ]
  },
  {
    id: 'sub-104',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T09:12:00Z',
    devices: [
      { id: 'dev-144', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.134' }
    ]
  },
  {
    id: 'sub-105',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T09:15:00Z',
    devices: [
      { id: 'dev-145', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.135' }
    ]
  },
  {
    id: 'sub-106',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T09:18:00Z',
    devices: [
      { id: 'dev-146', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.136' }
    ]
  },
  {
    id: 'sub-107',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T09:21:00Z',
    devices: [
      { id: 'dev-147', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.137' }
    ]
  },
  {
    id: 'sub-108',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T09:24:00Z',
    devices: [
      { id: 'dev-148', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.138' }
    ]
  },
  {
    id: 'sub-109',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T09:27:00Z',
    devices: [
      { id: 'dev-149', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.139' }
    ]
  },
  {
    id: 'sub-110',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T09:30:00Z',
    devices: [
      { id: 'dev-150', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.140' }
    ]
  },
  {
    id: 'sub-111',
    name: 'Margaret Thomas',
    email: 'margaret.thomas@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T09:33:00Z',
    devices: [
      { id: 'dev-151', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.141' }
    ]
  },
  {
    id: 'sub-112',
    name: 'Robert Lee',
    email: 'robert.lee@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T09:36:00Z',
    devices: [
      { id: 'dev-152', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.142' }
    ]
  },
  {
    id: 'sub-113',
    name: 'Barbara Sanchez',
    email: 'barbara.sanchez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T09:39:00Z',
    devices: [
      { id: 'dev-153', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.143' }
    ]
  },
  {
    id: 'sub-114',
    name: 'Charles Smith',
    email: 'charles.smith@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T09:42:00Z',
    devices: [
      { id: 'dev-154', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.144' }
    ]
  },
  {
    id: 'sub-115',
    name: 'Betty Garcia',
    email: 'betty.garcia@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T09:45:00Z',
    devices: [
      { id: 'dev-155', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.145' }
    ]
  },
  {
    id: 'sub-116',
    name: 'John Hernandez',
    email: 'john.hernandez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T09:48:00Z',
    devices: [
      { id: 'dev-156', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.146' }
    ]
  },
  {
    id: 'sub-117',
    name: 'Elizabeth Thomas',
    email: 'elizabeth.thomas@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T09:51:00Z',
    devices: [
      { id: 'dev-157', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.147' }
    ]
  },
  {
    id: 'sub-118',
    name: 'Thomas Lee',
    email: 'thomas.lee@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T09:54:00Z',
    devices: [
      { id: 'dev-158', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.148' }
    ]
  },
  {
    id: 'sub-119',
    name: 'Lisa Sanchez',
    email: 'lisa.sanchez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T09:57:00Z',
    devices: [
      { id: 'dev-159', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.149' }
    ]
  },
  {
    id: 'sub-120',
    name: 'James Smith',
    email: 'james.smith@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T10:00:00Z',
    devices: [
      { id: 'dev-100', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.150' }
    ]
  },
  {
    id: 'sub-121',
    name: 'Linda Garcia',
    email: 'linda.garcia@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T10:03:00Z',
    devices: [
      { id: 'dev-101', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.151' }
    ]
  },
  {
    id: 'sub-122',
    name: 'Joseph Hernandez',
    email: 'joseph.hernandez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T10:06:00Z',
    devices: [
      { id: 'dev-102', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.152' }
    ]
  },
  {
    id: 'sub-123',
    name: 'Nancy Thomas',
    email: 'nancy.thomas@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T10:09:00Z',
    devices: [
      { id: 'dev-103', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.153' }
    ]
  },
  {
    id: 'sub-124',
    name: 'Mark Lee',
    email: 'mark.lee@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T10:12:00Z',
    devices: [
      { id: 'dev-104', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.154' }
    ]
  },
  {
    id: 'sub-125',
    name: 'Jennifer Sanchez',
    email: 'jennifer.sanchez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T10:15:00Z',
    devices: [
      { id: 'dev-105', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.155' }
    ]
  },
  {
    id: 'sub-126',
    name: 'Richard Smith',
    email: 'richard.smith@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T10:18:00Z',
    devices: [
      { id: 'dev-106', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.156' }
    ]
  },
  {
    id: 'sub-127',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T10:21:00Z',
    devices: [
      { id: 'dev-107', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.157' }
    ]
  },
  {
    id: 'sub-128',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T10:24:00Z',
    devices: [
      { id: 'dev-108', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.158' }
    ]
  },
  {
    id: 'sub-129',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T10:27:00Z',
    devices: [
      { id: 'dev-109', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.159' }
    ]
  },
  {
    id: 'sub-130',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T10:30:00Z',
    devices: [
      { id: 'dev-110', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.160' }
    ]
  },
  {
    id: 'sub-131',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T10:33:00Z',
    devices: [
      { id: 'dev-111', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.161' }
    ]
  },
  {
    id: 'sub-132',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T10:36:00Z',
    devices: [
      { id: 'dev-112', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.162' }
    ]
  },
  {
    id: 'sub-133',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T10:39:00Z',
    devices: [
      { id: 'dev-113', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.163' }
    ]
  },
  {
    id: 'sub-134',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T10:42:00Z',
    devices: [
      { id: 'dev-114', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.164' }
    ]
  },
  {
    id: 'sub-135',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T10:45:00Z',
    devices: [
      { id: 'dev-115', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.165' }
    ]
  },
  {
    id: 'sub-136',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T10:48:00Z',
    devices: [
      { id: 'dev-116', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.166' }
    ]
  },
  {
    id: 'sub-137',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T10:51:00Z',
    devices: [
      { id: 'dev-117', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.167' }
    ]
  },
  {
    id: 'sub-138',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T10:54:00Z',
    devices: [
      { id: 'dev-118', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.168' }
    ]
  },
  {
    id: 'sub-139',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T10:57:00Z',
    devices: [
      { id: 'dev-119', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.169' }
    ]
  },
  {
    id: 'sub-140',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T10:00:00Z',
    devices: [
      { id: 'dev-120', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.170' }
    ]
  },
  {
    id: 'sub-141',
    name: 'Margaret Thomas',
    email: 'margaret.thomas@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T10:03:00Z',
    devices: [
      { id: 'dev-121', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.171' }
    ]
  },
  {
    id: 'sub-142',
    name: 'Robert Lee',
    email: 'robert.lee@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T10:06:00Z',
    devices: [
      { id: 'dev-122', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.172' }
    ]
  },
  {
    id: 'sub-143',
    name: 'Barbara Sanchez',
    email: 'barbara.sanchez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T10:09:00Z',
    devices: [
      { id: 'dev-123', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.173' }
    ]
  },
  {
    id: 'sub-144',
    name: 'Charles Smith',
    email: 'charles.smith@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T10:12:00Z',
    devices: [
      { id: 'dev-124', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.174' }
    ]
  },
  {
    id: 'sub-145',
    name: 'Betty Garcia',
    email: 'betty.garcia@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T10:15:00Z',
    devices: [
      { id: 'dev-125', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.175' }
    ]
  },
  {
    id: 'sub-146',
    name: 'John Hernandez',
    email: 'john.hernandez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T10:18:00Z',
    devices: [
      { id: 'dev-126', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.176' }
    ]
  },
  {
    id: 'sub-147',
    name: 'Elizabeth Thomas',
    email: 'elizabeth.thomas@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T10:21:00Z',
    devices: [
      { id: 'dev-127', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.177' }
    ]
  },
  {
    id: 'sub-148',
    name: 'Thomas Lee',
    email: 'thomas.lee@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T10:24:00Z',
    devices: [
      { id: 'dev-128', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.178' }
    ]
  },
  {
    id: 'sub-149',
    name: 'Lisa Sanchez',
    email: 'lisa.sanchez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T10:27:00Z',
    devices: [
      { id: 'dev-129', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.179' }
    ]
  },
  {
    id: 'sub-150',
    name: 'James Smith',
    email: 'james.smith@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T10:30:00Z',
    devices: [
      { id: 'dev-130', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.180' }
    ]
  },
  {
    id: 'sub-151',
    name: 'Linda Garcia',
    email: 'linda.garcia@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T10:33:00Z',
    devices: [
      { id: 'dev-131', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.181' }
    ]
  },
  {
    id: 'sub-152',
    name: 'Joseph Hernandez',
    email: 'joseph.hernandez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T10:36:00Z',
    devices: [
      { id: 'dev-132', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.182' }
    ]
  },
  {
    id: 'sub-153',
    name: 'Nancy Thomas',
    email: 'nancy.thomas@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T10:39:00Z',
    devices: [
      { id: 'dev-133', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.183' }
    ]
  },
  {
    id: 'sub-154',
    name: 'Mark Lee',
    email: 'mark.lee@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T10:42:00Z',
    devices: [
      { id: 'dev-134', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.184' }
    ]
  },
  {
    id: 'sub-155',
    name: 'Jennifer Sanchez',
    email: 'jennifer.sanchez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T10:45:00Z',
    devices: [
      { id: 'dev-135', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.185' }
    ]
  },
  {
    id: 'sub-156',
    name: 'Richard Smith',
    email: 'richard.smith@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T10:48:00Z',
    devices: [
      { id: 'dev-136', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.186' }
    ]
  },
  {
    id: 'sub-157',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T10:51:00Z',
    devices: [
      { id: 'dev-137', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.187' }
    ]
  },
  {
    id: 'sub-158',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T10:54:00Z',
    devices: [
      { id: 'dev-138', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.188' }
    ]
  },
  {
    id: 'sub-159',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T10:57:00Z',
    devices: [
      { id: 'dev-139', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.189' }
    ]
  },
  {
    id: 'sub-160',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T10:00:00Z',
    devices: [
      { id: 'dev-140', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.190' }
    ]
  },
  {
    id: 'sub-161',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T10:03:00Z',
    devices: [
      { id: 'dev-141', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.191' }
    ]
  },
  {
    id: 'sub-162',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T10:06:00Z',
    devices: [
      { id: 'dev-142', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.192' }
    ]
  },
  {
    id: 'sub-163',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T10:09:00Z',
    devices: [
      { id: 'dev-143', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.193' }
    ]
  },
  {
    id: 'sub-164',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T10:12:00Z',
    devices: [
      { id: 'dev-144', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.194' }
    ]
  },
  {
    id: 'sub-165',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T10:15:00Z',
    devices: [
      { id: 'dev-145', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.195' }
    ]
  },
  {
    id: 'sub-166',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T10:18:00Z',
    devices: [
      { id: 'dev-146', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.196' }
    ]
  },
  {
    id: 'sub-167',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T10:21:00Z',
    devices: [
      { id: 'dev-147', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.197' }
    ]
  },
  {
    id: 'sub-168',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T10:24:00Z',
    devices: [
      { id: 'dev-148', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.198' }
    ]
  },
  {
    id: 'sub-169',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T10:27:00Z',
    devices: [
      { id: 'dev-149', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.199' }
    ]
  },
  {
    id: 'sub-170',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T10:30:00Z',
    devices: [
      { id: 'dev-150', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.200' }
    ]
  },
  {
    id: 'sub-171',
    name: 'Margaret Thomas',
    email: 'margaret.thomas@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T10:33:00Z',
    devices: [
      { id: 'dev-151', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.201' }
    ]
  },
  {
    id: 'sub-172',
    name: 'Robert Lee',
    email: 'robert.lee@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T10:36:00Z',
    devices: [
      { id: 'dev-152', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.202' }
    ]
  },
  {
    id: 'sub-173',
    name: 'Barbara Sanchez',
    email: 'barbara.sanchez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T10:39:00Z',
    devices: [
      { id: 'dev-153', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.203' }
    ]
  },
  {
    id: 'sub-174',
    name: 'Charles Smith',
    email: 'charles.smith@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T10:42:00Z',
    devices: [
      { id: 'dev-154', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.204' }
    ]
  },
  {
    id: 'sub-175',
    name: 'Betty Garcia',
    email: 'betty.garcia@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T10:45:00Z',
    devices: [
      { id: 'dev-155', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.205' }
    ]
  },
  {
    id: 'sub-176',
    name: 'John Hernandez',
    email: 'john.hernandez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T10:48:00Z',
    devices: [
      { id: 'dev-156', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.206' }
    ]
  },
  {
    id: 'sub-177',
    name: 'Elizabeth Thomas',
    email: 'elizabeth.thomas@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T10:51:00Z',
    devices: [
      { id: 'dev-157', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.207' }
    ]
  },
  {
    id: 'sub-178',
    name: 'Thomas Lee',
    email: 'thomas.lee@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T10:54:00Z',
    devices: [
      { id: 'dev-158', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.208' }
    ]
  },
  {
    id: 'sub-179',
    name: 'Lisa Sanchez',
    email: 'lisa.sanchez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T10:57:00Z',
    devices: [
      { id: 'dev-159', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.209' }
    ]
  },
  {
    id: 'sub-180',
    name: 'James Smith',
    email: 'james.smith@example.com',
    plan: 'Basic',
    balance: 380,
    status: 'Active',
    lastLogin: '2026-10-30T11:00:00Z',
    devices: [
      { id: 'dev-100', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.210' }
    ]
  },
  {
    id: 'sub-181',
    name: 'Linda Garcia',
    email: 'linda.garcia@example.com',
    plan: 'Standard',
    balance: 170,
    status: 'Active',
    lastLogin: '2026-10-30T11:03:00Z',
    devices: [
      { id: 'dev-101', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.211' }
    ]
  },
  {
    id: 'sub-182',
    name: 'Joseph Hernandez',
    email: 'joseph.hernandez@example.com',
    plan: 'Premium',
    balance: 52,
    status: 'Active',
    lastLogin: '2026-10-30T11:06:00Z',
    devices: [
      { id: 'dev-102', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.212' }
    ]
  },
  {
    id: 'sub-183',
    name: 'Nancy Thomas',
    email: 'nancy.thomas@example.com',
    plan: 'Basic',
    balance: 440,
    status: 'Active',
    lastLogin: '2026-10-30T11:09:00Z',
    devices: [
      { id: 'dev-103', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.213' }
    ]
  },
  {
    id: 'sub-184',
    name: 'Mark Lee',
    email: 'mark.lee@example.com',
    plan: 'Standard',
    balance: 47,
    status: 'Active',
    lastLogin: '2026-10-30T11:12:00Z',
    devices: [
      { id: 'dev-104', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.214' }
    ]
  },
  {
    id: 'sub-185',
    name: 'Jennifer Sanchez',
    email: 'jennifer.sanchez@example.com',
    plan: 'Premium',
    balance: 365,
    status: 'Active',
    lastLogin: '2026-10-30T11:15:00Z',
    devices: [
      { id: 'dev-105', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.215' }
    ]
  },
  {
    id: 'sub-186',
    name: 'Richard Smith',
    email: 'richard.smith@example.com',
    plan: 'Basic',
    balance: 155,
    status: 'Active',
    lastLogin: '2026-10-30T11:18:00Z',
    devices: [
      { id: 'dev-106', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.216' }
    ]
  },
  {
    id: 'sub-187',
    name: 'Karen Garcia',
    email: 'karen.garcia@example.com',
    plan: 'Standard',
    balance: 38,
    status: 'Active',
    lastLogin: '2026-10-30T11:21:00Z',
    devices: [
      { id: 'dev-107', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.217' }
    ]
  },
  {
    id: 'sub-188',
    name: 'Anthony Hernandez',
    email: 'anthony.hernandez@example.com',
    plan: 'Premium',
    balance: 390,
    status: 'Active',
    lastLogin: '2026-10-30T11:24:00Z',
    devices: [
      { id: 'dev-108', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.218' }
    ]
  },
  {
    id: 'sub-189',
    name: 'Patricia Thomas',
    email: 'patricia.thomas@example.com',
    plan: 'Basic',
    balance: 50,
    status: 'Active',
    lastLogin: '2026-10-30T11:27:00Z',
    devices: [
      { id: 'dev-109', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.219' }
    ]
  },
  {
    id: 'sub-190',
    name: 'David Lee',
    email: 'david.lee@example.com',
    plan: 'Standard',
    balance: 150,
    status: 'Active',
    lastLogin: '2026-10-30T11:30:00Z',
    devices: [
      { id: 'dev-110', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.220' }
    ]
  },
  {
    id: 'sub-191',
    name: 'Sarah Sanchez',
    email: 'sarah.sanchez@example.com',
    plan: 'Premium',
    balance: 300,
    status: 'Active',
    lastLogin: '2026-10-30T11:33:00Z',
    devices: [
      { id: 'dev-111', name: 'Desktop', type: 'Mobile', ipAddress: '192.168.1.221' }
    ]
  },
  {
    id: 'sub-192',
    name: 'Matthew Smith',
    email: 'matthew.smith@example.com',
    plan: 'Basic',
    balance: 45,
    status: 'Active',
    lastLogin: '2026-10-30T11:36:00Z',
    devices: [
      { id: 'dev-112', name: 'Phone', type: 'Desktop', ipAddress: '192.168.1.222' }
    ]
  },
  {
    id: 'sub-193',
    name: 'Mary Garcia',
    email: 'mary.garcia@example.com',
    plan: 'Standard',
    balance: 180,
    status: 'Active',
    lastLogin: '2026-10-30T11:39:00Z',
    devices: [
      { id: 'dev-113', name: 'Tablet', type: 'Mobile', ipAddress: '192.168.1.223' }
    ]
  },
  {
    id: 'sub-194',
    name: 'William Hernandez',
    email: 'william.hernandez@example.com',
    plan: 'Premium',
    balance: 420,
    status: 'Active',
    lastLogin: '2026-10-30T11:42:00Z',
    devices: [
      { id: 'dev-114', name: 'Smartphone', type: 'Desktop', ipAddress: '192.168.1.224' }
    ]
  },
  {
    id: 'sub-195',
    name: 'Jessica Thomas',
    email: 'jessica.thomas@example.com',
    plan: 'Basic',
    balance: 55,
    status: 'Active',
    lastLogin: '2026-10-30T11:45:00Z',
    devices: [
      { id: 'dev-115', name: 'Laptop', type: 'Mobile', ipAddress: '192.168.1.225' }
    ]
  },
  {
    id: 'sub-196',
    name: 'Daniel Lee',
    email: 'daniel.lee@example.com',
    plan: 'Standard',
    balance: 160,
    status: 'Active',
    lastLogin: '2026-10-30T11:48:00Z',
    devices: [
      { id: 'dev-116', name: 'Desktop', type: 'Desktop', ipAddress: '192.168.1.226' }
    ]
  },
  {
    id: 'sub-197',
    name: 'Sandra Sanchez',
    email: 'sandra.sanchez@example.com',
    plan: 'Premium',
    balance: 350,
    status: 'Active',
    lastLogin: '2026-10-30T11:51:00Z',
    devices: [
      { id: 'dev-117', name: 'Phone', type: 'Mobile', ipAddress: '192.168.1.227' }
    ]
  },
  {
    id: 'sub-198',
    name: 'Michael Smith',
    email: 'michael.smith@example.com',
    plan: 'Basic',
    balance: 42,
    status: 'Active',
    lastLogin: '2026-10-30T11:54:00Z',
    devices: [
      { id: 'dev-118', name: 'Tablet', type: 'Desktop', ipAddress: '192.168.1.228' }
    ]
  },
  {
    id: 'sub-199',
    name: 'Susan Garcia',
    email: 'susan.garcia@example.com',
    plan: 'Standard',
    balance: 140,
    status: 'Active',
    lastLogin: '2026-10-30T11:57:00Z',
    devices: [
      { id: 'dev-119', name: 'Smartphone', type: 'Mobile', ipAddress: '192.168.1.229' }
    ]
  },
  {
    id: 'sub-200',
    name: 'Christopher Hernandez',
    email: 'christopher.hernandez@example.com',
    plan: 'Premium',
    balance: 48,
    status: 'Active',
    lastLogin: '2026-10-30T11:00:00Z',
    devices: [
      { id: 'dev-120', name: 'Laptop', type: 'Desktop', ipAddress: '192.168.1.30' }
    ]
  }
];

export const plans = [
  {
    id: 'plan-basic',
    name: 'Basic',
    price: 10,
    features: ['10GB Data', 'Basic Support', 'Standard Speed'],
    description: 'Perfect for light users with minimal needs'
  },
  {
    id: 'plan-standard',
    name: 'Standard',
    price: 25,
    features: ['50GB Data', 'Priority Support', 'Standard Speed'],
    description: 'Ideal for regular users with balanced needs'
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    price: 50,
    features: ['150GB Data', '24/7 Support', 'High Speed', 'Priority Access'],
    description: 'Best for heavy users with extensive demands'
  }
];

export const vouchers = [
  {
    id: 'vouch-001',
    code: 'SAVE100',
    value: 100,
    expiry: '2026-11-30',
    status: 'Active',
    type: 'Balance'
  },
  {
    id: 'vouch-002',
    code: 'WELCOME50',
    value: 50,
    expiry: '2026-12-31',
    status: 'Active',
    type: 'Balance'
  },
  {
    id: 'vouch-003',
    code: 'LIFETIME10',
    value: 10,
    expiry: '2027-12-31',
    status: 'Active',
    type: 'Discount'
  }
];