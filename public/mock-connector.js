export const mockConnectors = {
  // MikroTik RouterOS API
  'mikrotik': {
    connect: async (ip, username, password) => {
      // Simulate connection to MikroTik device
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `mikrotik-${ip.replace(/\./g, '-')}`,
          version: '6.49.6',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to MikroTik device'
      };
    },
    getStatus: async (ip) => {
      // Simulate getting device status
      return {
        device: {
          ip: ip,
          type: 'MikroTik',
          status: 'online',
          cpu: '45%',
          memory: '85%',
          cpuUsage: 45,
          memoryUsage: 85,
          uptime: '2h 15m',
          temperature: 32,
          interfaces: [
            { name: 'ether1', status: 'up', speed: '100Mbps', rxBytes: 123456, txBytes: 234567 },
            { name: 'ether2', status: 'up', speed: '100Mbps', rxBytes: 234567, txBytes: 345678 },
            { name: 'ether3', status: 'up', speed: '100Mbps', rxBytes: 345678, txBytes: 456789 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      // Simulate getting interfaces info
      return {
        device: {
          ip: ip,
          type: 'MikroTik',
          interfaces: [
            { name: 'ether1', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 123456, txBytes: 234567 },
            { name: 'ether2', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 234567, txBytes: 345678 },
            { name: 'ether3', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 345678, txBytes: 456789 }
          ]
        }
      };
    },
    getRouting: async (ip) => {
      // Simulate getting routing table
      return {
        device: {
          ip: ip,
          type: 'MikroTik',
          routes: [
            { dst: '0.0.0.0/0', gateway: '192.168.1.1', metric: 1 },
            { dst: '192.168.1.0/24', gateway: '192.168.1.1', metric: 0 }
          ]
        }
      };
    },
    getFirewall: async (ip) => {
      // Simulate getting firewall rules
      return {
        device: {
          ip: ip,
          type: 'MikroTik',
          rules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 80 },
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 443 }
          ]
        }
      };
    },
    getNAT: async (ip) => {
      // Simulate getting NAT rules
      return {
        device: {
          ip: ip,
          type: 'MikroTik',
          natRules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'masquerade', protocol: 'any' },
            { src: '192.168.1.0/24', dst: '192.168.1.10', action: 'translate', protocol: 'tcp', port: 80 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'client-900', name: 'Mock Client', ip: ip + '.100', type: 'WiFi', speed: 5, uptime: '1h' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  },

  // Cisco IOS Device
  'cisco': {
    connect: async (ip, username, password) => {
      // Simulate connection to Cisco device
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `cisco-${ip.replace(/\./g, '-')}`,
          version: '15.5(1)',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to Cisco device'
      };
    },
    getStatus: async (ip) => {
      // Simulate getting device status
      return {
        device: {
          ip: ip,
          type: 'Cisco',
          status: 'online',
          cpu: '35%',
          memory: '75%',
          cpuUsage: 35,
          memoryUsage: 75,
          uptime: '4h 20m',
          temperature: 38,
          interfaces: [
            { name: 'Ethernet0/1', status: 'up', speed: '100Mbps', rxBytes: 567890, txBytes: 678901 },
            { name: 'Ethernet0/2', status: 'up', speed: '100Mbps', rxBytes: 678901, txBytes: 789012 },
            { name: 'Ethernet0/3', status: 'up', speed: '100Mbps', rxBytes: 789012, txBytes: 890123 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      // Simulate getting interfaces info
      return {
        device: {
          ip: ip,
          type: 'Cisco',
          interfaces: [
            { name: 'Ethernet0/1', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 567890, txBytes: 678901 },
            { name: 'Ethernet0/2', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 678901, txBytes: 789012 },
            { name: 'Ethernet0/3', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 789012, txBytes: 890123 }
          ]
        }
      };
    },
    getRouting: async (ip) => {
      // Simulate getting routing table
      return {
        device: {
          ip: ip,
          type: 'Cisco',
          routes: [
            { dst: '0.0.0.0/0', gateway: '192.168.1.1', metric: 1 },
            { dst: '192.168.1.0/24', gateway: '192.168.1.1', metric: 0 }
          ]
        }
      };
    },
    getFirewall: async (ip) => {
      // Simulate getting firewall rules
      return {
        device: {
          ip: ip,
          type: 'Cisco',
          rules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'permit', protocol: 'tcp', port: 80 },
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'permit', protocol: 'tcp', port: 443 }
          ]
        }
      };
    },
    getNAT: async (ip) => {
      // Simulate getting NAT rules
      return {
        device: {
          ip: ip,
          type: 'Cisco',
          natRules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'nat', protocol: 'any' },
            { src: '192.168.1.0/24', dst: '192.168.1.10', action: 'static', protocol: 'tcp', port: 80 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'client-900', name: 'Mock Client', ip: ip + '.100', type: 'WiFi', speed: 5, uptime: '1h' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  },

  // Ubiquiti EdgeRouter
  'ubnt': {
    connect: async (ip, username, password) => {
      // Simulate connection to Ubiquiti device
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `ubnt-${ip.replace(/\./g, '-')}`,
          version: '1.15.14',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to Ubiquiti device'
      };
    },
    getStatus: async (ip) => {
      // Simulate getting device status
      return {
        device: {
          ip: ip,
          type: 'Ubiquiti',
          status: 'online',
          cpu: '50%',
          memory: '80%',
          cpuUsage: 50,
          memoryUsage: 80,
          uptime: '3h 45m',
          temperature: 30,
          interfaces: [
            { name: 'Wan', status: 'up', speed: '100Mbps', rxBytes: 112345, txBytes: 223456 },
            { name: 'Wireless', status: 'up', speed: '100Mbps', rxBytes: 223456, txBytes: 334567 },
            { name: 'Ethernet', status: 'up', speed: '100Mbps', rxBytes: 334567, txBytes: 445678 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      // Simulate getting interfaces info
      return {
        device: {
          ip: ip,
          type: 'Ubiquiti',
          interfaces: [
            { name: 'Wan', type: 'wlan', status: 'up', speed: '100Mbps', rxBytes: 112345, txBytes: 223456 },
            { name: 'Wireless', type: 'wlan', status: 'up', speed: '100Mbps', rxBytes: 223456, txBytes: 334567 },
            { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 334567, txBytes: 445678 }
          ]
        }
      };
    },
    getRouting: async (ip) => {
      // Simulate getting routing table
      return {
        device: {
          ip: ip,
          type: 'Ubiquiti',
          routes: [
            { dst: '0.0.0.0/0', gateway: '192.168.1.1', metric: 1 },
            { dst: '192.168.1.0/24', gateway: '192.168.1.1', metric: 0 }
          ]
        }
      };
    },
    getFirewall: async (ip) => {
      // Simulate getting firewall rules
      return {
        device: {
          ip: ip,
          type: 'Ubiquiti',
          rules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 80 },
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 443 }
          ]
        }
      };
    },
    getNAT: async (ip) => {
      // Simulate getting NAT rules
      return {
        device: {
          ip: ip,
          type: 'Ubiquiti',
          natRules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'masquerade', protocol: 'any' },
            { src: '192.168.1.0/24', dst: '192.168.1.10', action: 'translate', protocol: 'tcp', port: 80 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'client-900', name: 'Mock Client', ip: ip + '.100', type: 'WiFi', speed: 5, uptime: '1h' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  },

  // Mimosa Router
  'mimosa': {
    connect: async (ip, username, password) => {
      // Simulate connection to Mimosa device
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `mimosa-${ip.replace(/\./g, '-')}`,
          version: '1.2.3',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to Mimosa device'
      };
    },
    getStatus: async (ip) => {
      // Simulate getting device status
      return {
        device: {
          ip: ip,
          type: 'Mimosa',
          status: 'online',
          cpu: '60%',
          memory: '90%',
          cpuUsage: 60,
          memoryUsage: 90,
          uptime: '1h 30m',
          temperature: 35,
          interfaces: [
            { name: 'Ethernet', status: 'up', speed: '100Mbps', rxBytes: 456789, txBytes: 567890 },
            { name: 'Wireless', status: 'up', speed: '50Mbps', rxBytes: 567890, txBytes: 678901 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      // Simulate getting interfaces info
      return {
        device: {
          ip: ip,
          type: 'Mimosa',
          interfaces: [
            { name: 'Ethernet', type: 'ethernet', status: 'up', speed: '100Mbps', rxBytes: 456789, txBytes: 567890 },
            { name: 'Wireless', type: 'wlan', status: 'up', speed: '50Mbps', rxBytes: 567890, txBytes: 678901 }
          ]
        }
      };
    },
    getRouting: async (ip) => {
      // Simulate getting routing table
      return {
        device: {
          ip: ip,
          type: 'Mimosa',
          routes: [
            { dst: '0.0.0.0/0', gateway: '192.168.1.1', metric: 1 },
            { dst: '192.168.1.0/24', gateway: '192.168.1.1', metric: 0 }
          ]
        }
      };
    },
    getFirewall: async (ip) => {
      // Simulate getting firewall rules
      return {
        device: {
          ip: ip,
          type: 'Mimosa',
          rules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 80 },
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'allow', protocol: 'tcp', port: 443 }
          ]
        }
      };
    },
    getNAT: async (ip) => {
      // Simulate getting NAT rules
      return {
        device: {
          ip: ip,
          type: 'Mimosa',
          natRules: [
            { src: '192.168.1.0/24', dst: '0.0.0.0/0', action: 'masquerade', protocol: 'any' },
            { src: '192.168.1.0/24', dst: '192.168.1.10', action: 'translate', protocol: 'tcp', port: 80 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'client-900', name: 'Mock Client', ip: ip + '.100', type: 'WiFi', speed: 5, uptime: '1h' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  },

  // TP-Link home/SOHO router (web management UI)
  'tplink': {
    connect: async (ip, username, password) => {
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `tplink-${ip.replace(/\./g, '-')}`,
          version: '1.1.0 Build 20231010',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to TP-Link router'
      };
    },
    getStatus: async (ip) => {
      return {
        device: {
          ip: ip,
          type: 'TP-Link',
          status: 'online',
          cpu: '22%',
          memory: '48%',
          cpuUsage: 22,
          memoryUsage: 48,
          uptime: '6d 4h',
          temperature: null,
          wifi: [
            { band: '2.4GHz', ssid: 'TowerNet', channel: 6, clients: 9 },
            { band: '5GHz', ssid: 'TowerNet_5G', channel: 44, clients: 5 }
          ],
          interfaces: [
            { name: 'WAN', status: 'up', speed: '1000Mbps', rxBytes: 912345678, txBytes: 123456789 },
            { name: 'LAN1', status: 'up', speed: '1000Mbps', rxBytes: 45678901, txBytes: 56789012 },
            { name: 'LAN2', status: 'down', speed: '0Mbps', rxBytes: 0, txBytes: 0 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      return {
        device: {
          ip: ip,
          type: 'TP-Link',
          interfaces: [
            { name: 'WAN', type: 'ethernet', status: 'up', speed: '1000Mbps', rxBytes: 912345678, txBytes: 123456789 },
            { name: 'LAN1', type: 'ethernet', status: 'up', speed: '1000Mbps', rxBytes: 45678901, txBytes: 56789012 },
            { name: 'LAN2', type: 'ethernet', status: 'down', speed: '0Mbps', rxBytes: 0, txBytes: 0 },
            { name: 'wlan0', type: 'wlan', status: 'up', speed: '300Mbps', rxBytes: 23456789, txBytes: 87654321 },
            { name: 'wlan1', type: 'wlan', status: 'up', speed: '867Mbps', rxBytes: 34567890, txBytes: 98765432 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'tp-client-1', name: 'Phone', ip: '192.168.0.101', type: 'WiFi 5GHz', speed: 120, uptime: '3h' },
        { id: 'tp-client-2', name: 'Laptop', ip: '192.168.0.102', type: 'LAN1', speed: 940, uptime: '1d 2h' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  },

  // GPON/EPON ONU (fiber terminal)
  'onu': {
    connect: async (ip, username, password) => {
      return {
        success: true,
        device: {
          ip: ip,
          hostname: `onu-${ip.replace(/\./g, '-')}`,
          version: 'V3.0.1',
          status: 'connected',
          connectedAt: new Date().toISOString()
        },
        message: 'Successfully connected to ONU'
      };
    },
    getStatus: async (ip) => {
      return {
        device: {
          ip: ip,
          type: 'ONU',
          status: 'online',
          cpu: '15%',
          memory: '40%',
          cpuUsage: 15,
          memoryUsage: 40,
          uptime: '12d 7h',
          temperature: 46,
          pon: {
            mode: 'GPON',
            state: 'O5 (Operation)',
            serial: 'MOCK00000001',
            rxPowerDbm: -19.8,
            txPowerDbm: 2.3,
            voltage: 3.3,
            biasCurrentMa: 12.1
          },
          interfaces: [
            { name: 'PON', status: 'up', speed: '2488Mbps', rxBytes: 987654321, txBytes: 123456789 },
            { name: 'LAN1', status: 'up', speed: '1000Mbps', rxBytes: 98765432, txBytes: 876543210 }
          ]
        }
      };
    },
    getInterfaces: async (ip) => {
      return {
        device: {
          ip: ip,
          type: 'ONU',
          interfaces: [
            { name: 'PON', type: 'gpon', status: 'up', speed: '2488Mbps', rxBytes: 987654321, txBytes: 123456789 },
            { name: 'LAN1', type: 'ethernet', status: 'up', speed: '1000Mbps', rxBytes: 98765432, txBytes: 876543210 }
          ]
        }
      };
    },
    getClients: async (ip) => {
      return [
        { id: 'onu-client-1', name: 'Downstream router', ip: '192.168.1.2', type: 'LAN1', speed: 1000, uptime: '12d' }
      ];
    },
    runAction: async (name, args) => {
      return { success: true, action: name, args: args || {}, message: 'Mock action executed' };
    }
  }
};