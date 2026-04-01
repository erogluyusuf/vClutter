from scapy.all import (
    sniff, DNS, DNSQR, IP, IPv6, conf, get_working_ifaces, 
    Ether, ARP, srp, UDP, sr1, ICMP, send
)
try:
    from scapy.layers.netbios import NBNSQueryRequest, NBNSQueryResponse
except ImportError:
    pass

import logging
import time
import requests
import socket
import threading
import csv
import os
import json
import re
import subprocess
import platform
from concurrent.futures import ThreadPoolExecutor

# Loglama ayarları
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- KILL SWITCH CLASS (ARP POISONING) ---
class ArpBlocker(threading.Thread):
    def __init__(self, target_ip, gateway_ip, interface):
        super().__init__()
        self.target_ip = target_ip
        self.gateway_ip = gateway_ip
        self.interface = interface
        self.running = True
        self.daemon = True

    def run(self):
        logger.info(f"[KILL] {self.target_ip} için engelleme başlatıldı.")
        while self.running:
            try:
                # Hedef cihaza: "Ben Gateway'im (ama paketleri iletmeyeceğim)"
                send(ARP(op=2, pdst=self.target_ip, psrc=self.gateway_ip, hwdst="ff:ff:ff:ff:ff:ff"), verbose=0, iface=self.interface)
                time.sleep(1) 
            except Exception as e:
                logger.error(f"Kill Hatası: {e}")
                break
    
    def stop(self):
        self.running = False
        logger.info(f"[KILL] {self.target_ip} serbest bırakılıyor...")
        try:
            send(ARP(op=2, pdst=self.target_ip, psrc=self.gateway_ip, hwdst="ff:ff:ff:ff:ff:ff"), count=3, verbose=0, iface=self.interface)
        except: pass

class UmaySniffer:
    def __init__(self, callback=None):
        self.interface = self.detect_active_interface()
        self.callback = callback
        self.discovered_devices = {} 
        self.mac_db = {}
        self.active_killers = {} 
        self.network_info = { 
            "public_ip": "Yükleniyor...", "isp": "Yükleniyor...",
            "city": "...", "country": "...", "gateway": "..."
        }
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.base_dir, "data")
        self.json_path = os.path.join(self.data_dir, "devices.json")
        
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        
        self.load_ieee_database()
        self.load_devices_from_json()
        
        threading.Thread(target=self.fetch_network_details, daemon=True).start()

    # --- DNS RESOLVER (MODEMDEN YÖNLENDİRME İÇİN) ---
    def dns_resolver(self):
        """53. portu dinleyerek DNS Proxy görevi görür ve trafiği loglar."""
        try:
            dns_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            dns_sock.bind(('0.0.0.0', 53))
            logger.info("[*] Umay DNS Sunucusu 53. portta aktif!")
        except Exception as e:
            logger.error(f"[-] DNS Portu (53) açılamadı! systemd-resolved'u durdurun: {e}")
            return

        while True:
            try:
                data, addr = dns_sock.recvfrom(1024)
                dns_pkt = DNS(data)
                if dns_pkt.haslayer(DNSQR):
                    query_name = dns_pkt[DNSQR].qname.decode(errors='ignore').strip('.')
                    client_ip = addr[0]
                    
                    # Dashboard'a İsimli Bilgi Gönder
                    if self.callback:
                        self.callback({
                            "source": client_ip,
                            "destination": query_name,
                            "timestamp": time.time(),
                            "type": "dns_resolved"
                        })

                    # Gerçek DNS'e (Google) sor ve cevabı ilet
                    forward_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    forward_sock.settimeout(1.5)
                    forward_sock.sendto(data, ('8.8.8.8', 53))
                    try:
                        response, _ = forward_sock.recvfrom(1024)
                        dns_sock.sendto(response, addr)
                    except: pass
                    finally: forward_sock.close()
            except: continue

    def load_devices_from_json(self):
        if os.path.exists(self.json_path):
            try:
                with open(self.json_path, 'r', encoding='utf-8') as f:
                    self.discovered_devices = json.load(f)
                logger.info(f"[+] Veritabanı yüklendi: {len(self.discovered_devices)} cihaz.")
            except: self.discovered_devices = {}

    def save_devices_to_json(self):
        try:
            with open(self.json_path, 'w', encoding='utf-8') as f:
                json.dump(self.discovered_devices, f, indent=4, ensure_ascii=False)
        except: pass

    def load_ieee_database(self):
        csv_path = os.path.join(self.data_dir, "oui.csv")
        if not os.path.exists(csv_path): return
        try:
            with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.reader(f)
                next(reader, None)
                for row in reader:
                    if len(row) > 2: self.mac_db[row[1].strip().upper()] = row[2].strip()
        except: pass

    def fetch_network_details(self):
        try:
            gw = conf.route.route("0.0.0.0")[2]
            self.network_info["gateway"] = gw
            res = requests.get("http://ip-api.com/json/", timeout=5).json()
            self.network_info.update({
                "public_ip": res.get("query", "Bilinmiyor"),
                "isp": res.get("isp", "Bilinmiyor"),
                "city": res.get("city", "Bilinmiyor"),
                "country": res.get("country", "Bilinmiyor")
            })
            self.send_network_info()
        except: pass

    def send_network_info(self):
        if self.callback: self.callback({"type": "network_info", "data": self.network_info})

    def detect_active_interface(self):
        try:
            iface = conf.iface
            if not iface or str(iface) in ["lo", "lo0", "None"]:
                for i in get_working_ifaces():
                    if i.name != "lo" and i.ip: return i.name
            return str(iface)
        except: return "eth0"

    def toggle_kill(self, target_ip, state):
        if state:
            if target_ip in self.active_killers: return 
            gateway = self.network_info.get("gateway")
            killer = ArpBlocker(target_ip, gateway, self.interface)
            self.active_killers[target_ip] = killer
            killer.start()
        else:
            if target_ip in self.active_killers:
                self.active_killers[target_ip].stop()
                del self.active_killers[target_ip]

    def get_real_ping(self, ip):
        """Sistem Ping komutuyla daha gerçekçi sonuç üretir."""
        try:
            param = '-n' if platform.system().lower() == 'windows' else '-c'
            timeout_p = ['-W', '1'] if platform.system().lower() != 'windows' else ['-w', '1000']
            command = ['ping', param, '1'] + timeout_p + [ip]
            
            start = time.time()
            result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            end = time.time()
            
            if result.returncode == 0:
                return round(max(1, (end - start) * 1000 - 5), 2)
            return None
        except: return None

    def get_service_banner(self, ip, port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((ip, port))
            if port in [80, 8080, 443]:
                s.send(b"GET / HTTP/1.1\r\nHost: " + ip.encode() + b"\r\n\r\n")
                banner = s.recv(1024).decode(errors='ignore')
                server = re.search(r"Server: (.*)", banner)
                return server.group(1).strip() if server else "Web Sunucusu"
            banner = s.recv(1024).decode(errors='ignore').strip()
            s.close()
            return banner if banner else "Bilinmeyen Servis"
        except: return "Yanıt Yok"

    def scan_ports(self, ip):
        services = {}
        vulns = [] 
        tcp_ports = [21, 22, 23, 80, 443, 445, 3389, 8080]
        for port in tcp_ports:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.2)
                if s.connect_ex((ip, port)) == 0:
                    banner = self.get_service_banner(ip, port)
                    services[str(port)] = banner
                    if port == 21: vulns.append("FTP: Şifresiz Veri Aktarımı")
                    if port == 23: vulns.append("Telnet: Güvensiz Protokol")
                    if port == 445: vulns.append("SMB: Kritik Port (Exploit Riski)")
                s.close()
            except: continue
        return services, vulns

    def deep_scan(self, ip, mac, ttl=None):
        vendor = self.get_vendor(mac)
        hostname = self.get_hostname(ip)
        service_data, vulns = self.scan_ports(ip)
        os_guess = self.guess_os(ttl)
        
        self.discovered_devices[ip] = {
            "vendor": vendor, "mac": mac, "hostname": hostname,
            "os": os_guess, "services": service_data, "ports": list(service_data.keys()),
            "vulns": vulns, "last_seen": time.time()
        }
        self.save_devices_to_json()
        
        if self.callback:
            self.callback({
                "source": ip, "mac": mac, "destination": "Tarama Bitti", 
                "vendor": vendor, "hostname": hostname, "ports": list(service_data.keys()), 
                "os": os_guess, "services": service_data, "vulns": vulns,
                "timestamp": time.time()
            })

    def get_vendor(self, mac):
        return self.mac_db.get(mac.replace(":", "").upper()[:6], "Bilinmeyen Üretici")

    def get_hostname(self, ip):
        try:
            socket.setdefaulttimeout(0.2)
            return socket.gethostbyaddr(ip)[0]
        except: return "İsimsiz Cihaz"

    def guess_os(self, ttl):
        if not ttl: return "Bilinmiyor"
        return "Linux / Android" if ttl <= 64 else "Windows" if ttl <= 128 else "Network Device"

    def fast_sweep(self):
        gw = self.network_info.get("gateway", "192.168.1.1")
        base = ".".join(gw.split(".")[:3])
        with ThreadPoolExecutor(max_workers=50) as ex:
            for i in range(1, 255): ex.submit(self.scan_single_target, f"{base}.{i}")

    def scan_single_target(self, ip):
        try:
            pkt = Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(pdst=ip)
            res, _ = srp(pkt, timeout=1.0, verbose=0, iface=self.interface)
            for _, r in res: self.deep_scan(r.psrc, r.hwsrc)
        except: pass

    def process_packet(self, packet):
        if packet.haslayer(IP) and packet[IP].src.startswith("192.168."):
            src_ip = packet[IP].src
            dst_ip = packet[IP].dst
            
            # Gürültü Filtresi (Microsoft/Google/CDN)
            if dst_ip.startswith(("13.", "20.", "40.", "52.", "142.", "172.217", "104.")): return

            if src_ip not in self.discovered_devices:
                src_mac = packet[Ether].src if packet.haslayer(Ether) else "00:00:00:00:00:00"
                threading.Thread(target=self.deep_scan, args=(src_ip, src_mac, packet[IP].ttl), daemon=True).start()
            elif self.callback:
                dest = dst_ip
                if packet.haslayer(DNSQR): dest = packet[DNSQR].qname.decode(errors='ignore').strip('.')
                if not dest.startswith("192.168."):
                    self.callback({"source": src_ip, "destination": dest, "timestamp": time.time()})

    def start(self):
        # 1. Eski cihazları yükle
        if self.callback:
            for ip, d in self.discovered_devices.items():
                self.callback({**d, "source": ip, "destination": "Tarama Bitti", "timestamp": time.time()})
        
        # 2. DNS Sunucusunu başlat (Port 53)
        threading.Thread(target=self.dns_resolver, daemon=True).start()

        # 3. Otomatik Tarama başlat
        logger.info("[*] Başlangıç taraması (1-254) başlatılıyor...")
        threading.Thread(target=self.fast_sweep, daemon=True).start()

        # 4. Sniff başlat
        logger.info(f"[*] Umay Dinleme Modunda: {self.interface}")
        sniff(iface=self.interface, prn=self.process_packet, store=0)