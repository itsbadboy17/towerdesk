/* TowerDesk Arabic interface text. Loaded only when Arabic is selected.
   Pages are written in English; this swaps known phrases in place (text, placeholders, labels)
   and keeps watching, so text drawn later by the live pages is translated too. Anything not in
   the dictionary — device names, usernames, numbers, technical terms such as CCQ, SNR, MAC, IP,
   PPPoE and SAS — is left exactly as it is. Switching back to English restores the original. */
(function () {
    'use strict';
    window.TowerDesk = window.TowerDesk || {};

    var AR = {
        // Sidebar and shell
        'Network': 'الشبكة', 'Customers': 'العملاء', 'Overview': 'نظرة عامة', 'Monitoring': 'المراقبة',
        'Topology': 'مخطط الشبكة', 'Alerts': 'التنبيهات', 'Add Device': 'إضافة جهاز', 'Settings': 'الإعدادات',
        'Sign Out': 'تسجيل الخروج', 'Admin User': 'المدير', 'Super Admin': 'مدير عام', 'Language': 'اللغة',
        'Tower Map': 'خريطة الأبراج', 'Remote Actions': 'إجراءات عن بُعد', 'Plans': 'الباقات', 'Vouchers': 'الكروت',
        'Billing': 'الفوترة', 'Invoices': 'الفواتير', 'Tickets': 'التذاكر',
        // Common words and statuses
        'Live': 'مباشر', 'Connecting…': 'جارٍ الاتصال…', 'Disconnected — retrying': 'انقطع الاتصال — إعادة المحاولة',
        'Loading…': 'جارٍ التحميل…', 'Refresh': 'تحديث', 'Cancel': 'إلغاء', 'Close': 'إغلاق', 'Yes': 'نعم', 'No': 'لا',
        'Status': 'الحالة', 'Signal': 'الإشارة', 'Traffic': 'حركة البيانات', 'Rate': 'السرعة', 'Noise': 'الضجيج',
        'Frequency': 'التردد', 'Channel': 'القناة', 'Tx power': 'قدرة الإرسال', 'Temp': 'الحرارة', 'Distance': 'المسافة',
        'Availability': 'التوفر', 'Latency': 'زمن الاستجابة', 'Avg latency': 'متوسط زمن الاستجابة', 'Uptime': 'نسبة التشغيل',
        'Up for': 'يعمل منذ', 'Down for': 'متوقف منذ', 'Unknown for': 'غير معروف منذ', 'Up': 'يعمل', 'Down': 'متوقف',
        'Unknown': 'غير معروف', 'Clients': 'العملاء', 'Capacity': 'السعة', 'Remote end': 'الطرف البعيد',
        '● Online': '● متصل', '● Offline': '● غير متصل', '● Monitored': '● مُراقَب', '● Connected': '● متصل',
        '● Reachable': '● يستجيب', '● Unreachable': '● لا يمكن الوصول', '● Checking…': '● جارٍ الفحص…',
        '● Login failed': '● فشل الدخول', '● Came online': '● عاد للعمل', '● Went offline': '● توقف',
        'Online': 'متصل', 'Offline': 'غير متصل', 'online': 'متصل', 'None found': 'لا يوجد', 'No devices yet': 'لا توجد أجهزة بعد', 'All': 'الكل', 'connected': 'متصل', 'link down': 'الرابط متوقف',
        'checking…': 'جارٍ الفحص…', 'unreachable': 'لا يمكن الوصول', 'total traffic': 'إجمالي حركة البيانات',
        'Open details': 'عرض التفاصيل', 'Sector': 'قطاع', 'Device': 'جهاز', 'Model': 'الموديل', 'Type': 'النوع',
        'Role': 'الدور', 'Firmware': 'الإصدار', 'Connected via': 'طريقة الاتصال', 'Last result': 'آخر نتيجة',
        // Monitoring
        'Network Monitor': 'مراقبة الشبكة', 'Devices': 'الأجهزة', 'Monitored': 'تحت المراقبة', 'Total Traffic': 'إجمالي حركة البيانات',
        'RX + TX, live': 'استقبال + إرسال، مباشر', 'Sectors': 'القطاعات', 'Subscribers': 'المشتركون',
        'Connected clients': 'عملاء متصلون', 'PtMP access points': 'نقاط توزيع', 'Needs attention': 'يحتاج إلى انتباه',
        'Live Devices': 'الأجهزة الآن', 'Backhaul links': 'روابط الربط الرئيسية', 'Sectors & devices': 'القطاعات والأجهزة',
        'Recent Events': 'آخر الأحداث', 'Time': 'الوقت', 'Event': 'الحدث', 'All providers': 'كل المزوّدين',
        'Unassigned': 'غير محدد', 'Both ends monitored': 'الطرفان تحت المراقبة', 'Slave end only': 'طرف السليف فقط',
        'Device detail': 'تفاصيل الجهاز', 'Link detail': 'تفاصيل الرابط', 'Sector detail': 'تفاصيل القطاع',
        'Open device page ↗': 'فتح صفحة الجهاز ↗', 'Ping': 'Ping', 'Traceroute': 'تتبّع المسار',
        'Open this end': 'فتح هذا الطرف', 'Live': 'مباشر', 'Latency (10 min)': 'زمن الاستجابة (10 دقائق)',
        'Registration (connected stations)': 'التسجيل (الأجهزة المتصلة)', 'Station': 'الجهاز', 'MAC / IP': 'MAC / IP',
        'SAS user': 'مستخدم SAS', 'Rate tx/rx': 'السرعة إرسال/استقبال', '↓ To client': '↓ إلى العميل',
        '↑ From client': '↑ من العميل', 'Not in SAS': 'غير موجود في SAS', 'Export to Excel': 'تصدير إلى Excel',
        'No stations registered right now.': 'لا توجد أجهزة مسجّلة الآن.', 'Traffic sent': 'البيانات المُرسلة',
        '○ Not monitored — read from the slave': '○ غير مُراقَب — القراءة من السليف',
        'Nothing needs attention — every reachable device, link and customer radio looks fine.': 'لا شيء يحتاج إلى انتباه — كل الأجهزة والروابط وأجهزة العملاء التي يمكن الوصول إليها تعمل جيداً.',
        'No events yet. Status changes will appear here.': 'لا توجد أحداث بعد. ستظهر تغيّرات الحالة هنا.',
        "Can't reach the tower network": 'تعذّر الوصول إلى شبكة البرج',
        // Overview
        'Devices online': 'الأجهزة المتصلة', 'Uplinks': 'روابط المصدر', 'Customer radios': 'أجهزة العملاء',
        'Registered on sectors': 'مسجّلة على القطاعات', 'Subscribers online': 'المشتركون المتصلون', 'From SAS': 'من SAS',
        'SAS not connected': 'SAS غير مربوط', 'Total traffic': 'إجمالي حركة البيانات', 'Link': 'الرابط',
        'Capacity used': 'السعة المستخدمة', 'Radios': 'الأجهزة', 'Weakest radio': 'أضعف جهاز',
        'Top users right now': 'الأكثر استخداماً الآن', 'Recent changes': 'آخر التغيّرات',
        'Since TowerDesk was opened': 'منذ فتح TowerDesk', 'Open Monitoring': 'فتح المراقبة', 'Open Topology': 'فتح مخطط الشبكة',
        'Open SAS': 'فتح SAS', 'No status changes yet.': 'لا توجد تغيّرات في الحالة بعد.', 'By live download': 'حسب التنزيل الآن',
        'No backhaul links found yet.': 'لم يُعثر على روابط رئيسية بعد.', 'No sectors found yet.': 'لم يُعثر على قطاعات بعد.',
        'came online': 'عاد للعمل', 'went offline': 'توقف',
        // Topology
        'Network tree': 'شجرة الشبكة', 'Tower': 'البرج', 'Routers and other devices': 'الراوترات والأجهزة الأخرى',
        'Uplinks, devices, sectors and customer radios': 'روابط المصدر والأجهزة والقطاعات وأجهزة العملاء',
        // SAS
        'Connect server': 'ربط السيرفر', 'Online Now': 'متصلون الآن', 'Active sessions': 'جلسات نشطة',
        'Known accounts': 'حسابات معروفة', 'Download': 'التنزيل', 'Upload': 'الرفع', 'Aggregate, live': 'الإجمالي، مباشر',
        'Subscriber Sessions': 'جلسات المشتركين', 'Subscriber': 'المشترك', 'Plan': 'الباقة', 'Sector / radio': 'القطاع / الجهاز',
        'Session': 'الجلسة', 'Data (↓ / ↑)': 'البيانات (↓ / ↑)', 'Live rate': 'السرعة الآن',
        'No subscribers match.': 'لا يوجد مشتركون مطابقون.', "Radios and users that don't match": 'أجهزة ومستخدمون غير متطابقين',
        'Username': 'اسم المستخدم', 'Password': 'كلمة المرور', 'Account': 'الحساب', 'IP address': 'عنوان IP',
        'MAC address': 'عنوان MAC', 'Downloaded': 'تم تنزيله', 'Uploaded': 'تم رفعه', 'Live speed': 'السرعة الآن',
        'Expires': 'ينتهي في', 'Phone': 'الهاتف', 'Last seen': 'آخر ظهور', 'On the tower': 'على البرج', 'Radio': 'الجهاز',
        'Open this sector': 'فتح هذا القطاع', 'Not connected right now.': 'غير متصل الآن.',
        'No radio on a monitored sector has this MAC address.': 'لا يوجد جهاز على قطاع مُراقَب بهذا العنوان.',
        'RADIUS / SAS server': 'سيرفر RADIUS / SAS', 'Source': 'المصدر', 'Not connected': 'غير مربوط',
        'Host / IP': 'العنوان / IP', 'Port': 'المنفذ', 'Save & use': 'حفظ واستخدام', 'Sector / NAS label': 'اسم القطاع / NAS',
        'Demo data.': 'بيانات تجريبية.', 'No RADIUS/SAS server connected.': 'لا يوجد سيرفر RADIUS/SAS مربوط.',
        // Settings
        'Software updates': 'تحديثات البرنامج', 'GitHub repository': 'مستودع GitHub', 'Stable releases': 'الإصدارات المستقرة',
        'Pre-releases (early)': 'إصدارات تجريبية (مبكرة)', 'Save source': 'حفظ المصدر', 'Check for updates': 'البحث عن تحديثات',
        'Access token (only for a private repository)': 'رمز الوصول (للمستودع الخاص فقط)', 'Remove saved token': 'حذف الرمز المحفوظ',
        'Backup and restore': 'النسخ الاحتياطي والاستعادة', 'Devices, saved logins and settings': 'الأجهزة وبيانات الدخول والإعدادات',
        'Download backup': 'تنزيل نسخة احتياطية', 'Restore from a backup file': 'الاستعادة من ملف نسخة احتياطية',
        'Restore…': 'استعادة…', 'About this install': 'عن هذه النسخة', 'Portable & offline': 'محمولة وتعمل بدون إنترنت',
        'Version': 'الإصدار', 'Self-update': 'التحديث الذاتي', 'Data': 'البيانات', 'Internet': 'الإنترنت',
        'Local only': 'محلية فقط', 'Not required': 'غير مطلوب', 'Supported': 'مدعوم', 'Offline-ready': 'يعمل بدون إنترنت',
        'You are up to date.': 'لديك أحدث إصدار.', 'Download & install': 'تنزيل وتثبيت', 'Release notes': 'ملاحظات الإصدار',
        // Alerts / Add device (common labels)
        'Acknowledge': 'تأكيد الاستلام', 'Active': 'نشط', 'Resolved': 'تم الحل', 'Severity': 'الأهمية', 'Message': 'الرسالة',
        'Critical': 'حرِج', 'Warning': 'تحذير', 'Opened': 'بدأ في', 'Name': 'الاسم', 'IP Address': 'عنوان IP',
        'Location': 'الموقع', 'Method': 'الطريقة', 'Upstream provider': 'المزوّد', 'Save & test': 'حفظ واختبار',
        'Tower details': 'تفاصيل البرج', 'Search': 'بحث', 'Actions': 'الإجراءات', 'Remove': 'حذف', 'Edit': 'تعديل',
        'Saved Logins': 'بيانات الدخول المحفوظة', 'Scan': 'فحص', 'Test': 'اختبار', 'Add': 'إضافة', 'Save': 'حفظ'
    };

    // Phrases with a number or name in the middle.
    // Added after going through every page in Arabic and collecting what was still English.
    var AR_MORE = {
        "OLT detail": "تفاصيل OLT",
        "ONUs (fibre customers)": "أجهزة ONU (مشتركو الألياف)",
        "ONUs online": "ONU متصلة",
        "Rx power": "قدرة الاستقبال",
        "Tx power": "قدرة الإرسال",
        "Rx at OLT": "الاستقبال عند OLT",
        "Temp": "الحرارة",
        "Temperature": "درجة الحرارة",
        "Distance": "المسافة",
        "Fibre length": "طول الليف",
        "Serial / MAC": "الرقم التسلسلي / MAC",
        "Search ONUs": "بحث في أجهزة ONU",
        "Search name, user, serial or MAC": "ابحث بالاسم أو المستخدم أو الرقم التسلسلي أو MAC",
        "No ONU matches.": "لا يوجد ONU مطابق.",
        "No ONUs registered on this OLT right now.": "لا توجد أجهزة ONU مسجلة على هذا OLT حالياً.",
        "Not in SAS": "غير موجود في SAS",
        "matched by name": "مطابقة بالاسم",
        "session offline": "الجلسة غير متصلة",
        "Connect your SAS server on the SAS page to see the PPPoE user of each ONU.": "اربط سيرفر SAS من صفحة SAS لرؤية مستخدم PPPoE لكل ONU.",
        "OLT (Fiber, reads its ONUs over SNMP)": "OLT (ألياف، يقرأ أجهزة ONU عبر SNMP)",
        "ONU (Fiber GPON/EPON)": "ONU (ألياف GPON/EPON)",
        "Show the optical power history of this ONU": "عرض سجل القدرة الضوئية لهذا ONU",
        "Show this radio's signal history": "عرض سجل إشارة هذا الراديو",
        "weak optical power or running hot": "قدرة ضوئية ضعيفة أو حرارة مرتفعة",
        "Backhaul link": "رابط رئيسي",
        "Sector (PtMP)": "قطاع (PtMP)",
        "Device": "جهاز",
        "Other": "أخرى",
        "Interface": "المنفذ",
        "Clients total": "مجموع العملاء",
        "Traffic & interfaces": "الحركة والمنافذ",
        "Traffic & clients": "الحركة والعملاء",
        "Traffic": "الحركة",
        "MAC / IP": "MAC / IP",
        "signal": "الإشارة",
        "CPU": "المعالج",
        "RAM": "الذاكرة",
        "Down": "تنزيل",
        "Up": "رفع",
        "Link": "الرابط",
        "Tower network unreachable — status unknown": "شبكة البرج غير قابلة للوصول — الحالة غير معروفة",
        "Nothing on it answered — if you connect through a VPN, check that it is open.": "لم يرد أي جهاز عليها — إذا كنت تتصل عبر VPN فتأكد أنه مفتوح.",
        "Read-only connection": "اتصال للقراءة فقط",
        "Last Result": "آخر نتيجة",
        "Now": "الآن",
        "Towers": "الأبراج",
        "Logged in and collecting live data.": "تم تسجيل الدخول وجاري جمع البيانات المباشرة.",
        "No reply to ping or the management port.": "لا يوجد رد على ping أو منفذ الإدارة.",
        "Answers ping/web, but with no login — status only, no traffic graphs. Add a login or SNMP to monitor it fully.": "يرد على ping/الويب لكن بدون تسجيل دخول — الحالة فقط بدون رسوم الحركة. أضف تسجيل دخول أو SNMP لمراقبته بالكامل.",
        "Switch to light theme": "التبديل إلى المظهر الفاتح",
        "Switch to dark theme": "التبديل إلى المظهر الداكن",
        "Open navigation menu": "فتح قائمة التنقل",
        "open Monitoring": "افتح المراقبة",
        "Live monitor": "المراقبة المباشرة",
        "All clear": "كل شيء سليم",
        "Active Alerts": "التنبيهات النشطة",
        "Resolved alerts": "التنبيهات المحلولة",
        "Resolved (24h)": "تم حلها (24 ساعة)",
        "Events": "الأحداث",
        "History": "السجل",
        "Problem": "المشكلة",
        "Resolution": "الحل",
        "Duration": "المدة",
        "Lasted": "استمر",
        "Action": "إجراء",
        "Check": "تحقق",
        "Device offline": "الجهاز غير متصل",
        "Device responded again": "عاد الجهاز للاستجابة",
        "Closed automatically": "أُغلق تلقائياً",
        "Devices going online / offline": "اتصال / انقطاع الأجهزة",
        "Latency ≥ 200 ms": "زمن الاستجابة ≥ 200 مللي ثانية",
        "Critical": "حرج",
        "Warning": "تحذير",
        "Notifications blocked in browser": "الإشعارات محظورة في المتصفح",
        "No active alerts. Devices that stop responding show up here within seconds.": "لا توجد تنبيهات نشطة. الأجهزة التي تتوقف عن الاستجابة تظهر هنا خلال ثوانٍ.",
        "From the live monitor · updates every 10 s": "من المراقبة المباشرة · تحديث كل 10 ث",
        "Register New Device": "تسجيل جهاز جديد",
        "Device Name": "اسم الجهاز",
        "Device Type": "نوع الجهاز",
        "Select type": "اختر النوع",
        "Connect Using": "الاتصال عبر",
        "Monitor via": "المراقبة عبر",
        "Connection Result": "نتيجة الاتصال",
        "Test Connection": "اختبار الاتصال",
        "Auto-detect": "كشف تلقائي",
        "Add Selected": "إضافة المحدد",
        "Save login": "حفظ الدخول",
        "Scan": "فحص",
        "Scan a Network": "فحص شبكة",
        "Scan progress": "تقدم الفحص",
        "Enable SNMP": "تفعيل SNMP",
        "Fix unconnected": "إصلاح غير المتصلة",
        "IP Range": "نطاق IP",
        "Found": "تم العثور",
        "Stop": "إيقاف",
        "Delete": "حذف",
        "My Devices": "أجهزتي",
        "Apply to selected": "تطبيق على المحدد",
        "Select all devices": "تحديد كل الأجهزة",
        "Select all found devices": "تحديد كل الأجهزة المكتشفة",
        "Label (optional)": "تسمية (اختياري)",
        "Community": "Community",
        "SNMP Community": "SNMP Community",
        "SNMP community": "SNMP community",
        "SNMP Community (optional)": "SNMP Community (اختياري)",
        "SNMP community (optional)": "SNMP community (اختياري)",
        "Username & password": "اسم المستخدم وكلمة المرور",
        "Ping only (no login)": "Ping فقط (بدون دخول)",
        "Web UI (HTTP)": "واجهة الويب (HTTP)",
        "Web UI (HTTPS)": "واجهة الويب (HTTPS)",
        "Mimosa login": "دخول Mimosa",
        "Ubiquiti airOS login": "دخول Ubiquiti airOS",
        "TP-Link router login": "دخول راوتر TP-Link",
        "MikroTik Router": "راوتر MikroTik",
        "Cisco Router": "راوتر Cisco",
        "TP-Link Router": "راوتر TP-Link",
        "Checks the device is up. No login needed. Good for ONUs and anything you only want to watch.": "يتحقق أن الجهاز يعمل. لا يحتاج تسجيل دخول. مناسب لأجهزة ONU وأي جهاز تريد مراقبته فقط.",
        "Finds every device in a range · read-only, never logs in": "يجد كل الأجهزة في النطاق · قراءة فقط ولا يسجل الدخول أبداً",
        "Tried automatically when you add a device": "تُجرَّب تلقائياً عند إضافة جهاز",
        "Or type one login for all selected": "أو اكتب دخولاً واحداً لكل المحدد",
        "Enter an IP and press": "أدخل عنوان IP واضغط",
        "Try my": "جرّب",
        "login": "دخول",
        "leave blank to keep": "اتركه فارغاً للإبقاء",
        "to find the vendor and the best way to connect, or pick a method and press": "لمعرفة الشركة وأفضل طريقة للاتصال، أو اختر طريقة واضغط",
        "Whatever matches is saved encrypted with each device. Leave both empty to add with status checks only and set logins later.": "ما يتطابق يُحفظ مشفراً مع كل جهاز. اترك الحقلين فارغين للإضافة بفحص الحالة فقط وأضف الدخول لاحقاً.",
        "Try your saved logins & SNMP communities on every device that isn't connected yet": "جرّب بيانات الدخول و SNMP المحفوظة على كل جهاز لم يتصل بعد",
        "Turn on SNMP on the router and monitor it that way": "شغّل SNMP على الراوتر وراقبه بهذه الطريقة",
        "Timed out (device unreachable or port filtered)": "انتهت المهلة (الجهاز غير قابل للوصول أو المنفذ محجوب)",
        "Wrong username or password": "اسم المستخدم أو كلمة المرور خطأ",
        "e.g. Building A, Roof": "مثال: المبنى أ، السطح",
        "e.g. Core NAS": "مثال: NAS الرئيسي",
        "e.g. Main admin": "مثال: المدير الرئيسي",
        "e.g. Tower North Router": "مثال: راوتر البرج الشمالي",
        "Demo data (sample subscribers)": "بيانات تجريبية (مشتركون للعرض)",
        "FreeRADIUS (SQL)": "FreeRADIUS (SQL)",
        "MikroTik NAS (PPPoE / Hotspot)": "MikroTik NAS (PPPoE / Hotspot)",
        "SAS Radius 4 (manager login)": "SAS Radius 4 (دخول المدير)",
        "Where TowerDesk reads your subscribers from": "من أين يقرأ TowerDesk مشتركيك",
        "Filter subscribers": "تصفية المشتركين",
        "Search subscribers": "بحث في المشتركين",
        "Search name, username, IP, MAC or sector…": "ابحث بالاسم أو المستخدم أو IP أو MAC أو القطاع…",
        "These are sample subscriber sessions — connect your RADIUS/SAS server to see real customers.": "هذه جلسات مشتركين للعرض — اربط سيرفر RADIUS/SAS لرؤية العملاء الحقيقيين.",
        "A backup is one file with your devices, saved logins, alerts and settings.": "النسخة الاحتياطية ملف واحد فيه أجهزتك وبيانات الدخول المحفوظة والتنبيهات والإعدادات.",
        "Keep it private:": "احتفظ به بشكل خاص:",
        "it holds your saved device passwords together with the key that unlocks them. Monitoring history is not included.": "يحتوي كلمات مرور أجهزتك المحفوظة مع المفتاح الذي يفتحها. سجل المراقبة غير مشمول.",
        "TowerDesk can update itself from your GitHub repository. Nothing is downloaded until you check — the app stays fully offline otherwise.": "يستطيع TowerDesk تحديث نفسه من مستودع GitHub. لا يُنزَّل شيء حتى تضغط تحقق — وغير ذلك يبقى التطبيق بلا إنترنت تماماً.",
        "…or a release manifest URL (optional)": "…أو رابط ملف الإصدار (اختياري)",
        "Read-only GitHub token": "رمز GitHub للقراءة فقط",
        "Upgrade Premium": "ترقية",
        "Upgrade Infrastructure": "ترقية البنية",
        "Unlock unlimited towers, real-time sync & advanced analytics.": "أبراج غير محدودة ومزامنة فورية وتحليلات متقدمة."
    };
    Object.keys(AR_MORE).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(AR, k)) AR[k] = AR_MORE[k]; });

    // Sector advisor and AI settings.
    var AR_ADVISOR = {
        'Finance': 'المالية', 'Status report': 'تقرير الحالة', 'Copy text': 'انسخ النص', 'Open WhatsApp': 'افتح واتساب',
        'Tell customers…': 'أبلغ المشتركين…', 'Tell customers': 'أبلغ المشتركين', 'Planned work?': 'أعمال مجدولة؟',
        'Start maintenance': 'ابدأ الصيانة', 'End maintenance': 'أنهِ الصيانة', 'In maintenance': 'قيد الصيانة', 'End now': 'أنهِ الآن',
        'Staff accounts': 'حسابات الموظفين', 'Messages': 'الرسائل', 'Add account': 'أضف حساباً', 'Username': 'اسم المستخدم',
        'Admin': 'مدير', 'Technician': 'فني', 'Viewer': 'مشاهد', 'Notes': 'ملاحظات', 'Save note': 'احفظ الملاحظة',
        'Ports': 'المنافذ', 'Switch detail': 'تفاصيل السويتش', 'Devices behind it': 'أجهزة خلفه', 'Plugged into': 'متصل بـ', 'Errors': 'أخطاء',
        'Monthly revenue': 'الإيراد الشهري', 'Monthly costs': 'التكاليف الشهرية', 'Estimated profit': 'الربح التقديري',
        'Active subscribers': 'المشتركون الفعّالون', 'Renewals in 7 days': 'تجديدات خلال 7 أيام', 'Revenue by plan': 'الإيراد حسب الباقة',
        'Renewals coming up': 'التجديدات القادمة', 'Remind customers to renew': 'ذكّر المشتركين بالتجديد', 'Trend': 'الاتجاه',
        'Prices and costs': 'الأسعار والتكاليف', 'Save prices and costs': 'احفظ الأسعار والتكاليف', 'Add a cost': 'أضف تكلفة',
        'What is next to what': 'ما المجاور لماذا', 'Scan neighbours': 'افحص الأجهزة المجاورة', 'Seen next to it': 'يُرى بجانبه',
        'Use this': 'استخدم هذا', 'Add to site': 'أضف إلى موقع', 'Back': 'السابق', 'Find the device': 'ابحث عن الجهاز',
        'How to connect': 'طريقة الاتصال', 'Check it works': 'تحقق من عمله', 'Name it and add it': 'سمِّه وأضفه',
        'Show everything at once': 'اعرض كل شيء مرة واحدة', 'Use the step-by-step guide': 'استخدم الدليل خطوة بخطوة',
        'Design': 'التصميم', 'Search devices, customers, pages…': 'ابحث عن أجهزة ومشتركين وصفحات…',
        'Overview': 'نظرة عامة', 'Customers': 'المشتركون', 'Advisor': 'المستشار', 'More readings': 'قراءات أخرى',
        'Live data': 'بيانات حية', 'Starting…': 'جارٍ البدء…', 'Ping only': 'Ping فقط', 'Wrong login': 'دخول خاطئ', 'Not answering': 'لا يستجيب',
        'Login closed': 'الدخول مغلق', 'Login failed': 'فشل الدخول', 'No live data': 'لا توجد بيانات حية',
        'Sector traffic': 'حركة القطاعات', 'Customers, all sectors': 'العملاء، كل القطاعات', 'Customer radios': 'أجهزة العملاء',
        'Connected to sectors': 'متصلة بالقطاعات', 'Added to TowerDesk': 'مضافة إلى TowerDesk', 'Point to multipoint': 'نقطة إلى عدة نقاط',
        'Customers and setup, since TowerDesk was opened': 'العملاء والإعدادات منذ فتح TowerDesk',
        'Find a better channel': 'ابحث عن قناة أفضل', 'Change history': 'سجل التغييرات', 'Channels': 'القنوات', 'Use this channel': 'استخدم هذه القناة',
        'Apply again': 'طبّق مجدداً', 'Copy command': 'انسخ الأمر', 'Technical output': 'مخرجات تقنية', 'Clear by': 'الفاصل', 'Nearest radio': 'أقرب راديو',
        'What the check found': 'ما وجده الفحص', 'Move': 'الانتقال',
        'How TowerDesk connects to this device': 'كيف يتصل TowerDesk بهذا الجهاز', 'Change to': 'غيّر إلى', 'Connect': 'اتصل',
        'Automatic: try my saved logins': 'تلقائي: جرّب بيانات الدخول المحفوظة', 'Username and password…': 'اسم المستخدم وكلمة المرور…',
        'Ping only (no login)': 'Ping فقط (بدون دخول)', 'Cancel': 'إلغاء', 'Try and save': 'جرّب واحفظ', 'Username': 'اسم المستخدم', 'Password': 'كلمة المرور', 'Open': 'فتح',
        'Address': 'العنوان', 'Brand': 'الشركة', 'Last test': 'آخر اختبار', 'Role': 'الدور', 'Connected via': 'متصل عبر',
        'What do the status words mean?': 'ماذا تعني كلمات الحالة؟',
        'What is a site?': 'ما هو الموقع؟', 'Add to site': 'أضف إلى موقع', 'Take out of its site': 'أخرجه من موقعه', 'Untick all': 'إلغاء تحديد الكل',
        'Select all in this card': 'تحديد كل ما في هذه البطاقة', 'Gets its internet from': 'يحصل على الإنترنت من',
        'The internet (first device after my provider)': 'الإنترنت (أول جهاز بعد المزود)',
        'Step 2: name the site': 'الخطوة 2: سمِّ الموقع', 'Step 3: Add to site': 'الخطوة 3: أضف إلى الموقع',
        'Step 1: tick the boxes next to the devices that are on the same tower (or click a device row).': 'الخطوة 1: حدد المربعات بجانب الأجهزة الموجودة على نفس البرج (أو اضغط على صف الجهاز).',
        'Traceroute': 'تتبع المسار', 'sent': 'أُرسلت', 'replied': 'ردّت', 'lost': 'ضائعة', 'average': 'المتوسط', 'Step': 'الخطوة', 'Time': 'الزمن',
        'Now': 'الآن', 'Average': 'المتوسط', 'Worst': 'الأسوأ', 'now': 'الآن', 'Latency, last 10 minutes': 'زمن الاستجابة، آخر 10 دقائق',
        'Monitored directly': 'مراقب مباشرة',
        'Online —': 'متصل —', 'Offline —': 'غير متصل —', 'Needs attention —': 'يحتاج انتباه —', 'Unknown —': 'غير معروف —',
        'session online': 'الجلسة متصلة', 'No radio found': 'لم يُعثر على راديو',
        'This customer is not on any sector or OLT TowerDesk can read.': 'هذا العميل ليس على أي قطاع أو OLT يستطيع TowerDesk قراءته.',
        'Nothing looks wrong on this path.': 'لا شيء يبدو خاطئاً في هذا المسار.',
        'Nothing looks wrong on the radio or the sector. What it connects to is not set up yet, so the rest of the path is not checked.': 'لا شيء يبدو خاطئاً في الراديو أو القطاع. لم يُحدَّد بعد بماذا يتصل، لذلك لم يُفحص باقي المسار.',
        'Some devices on the path cannot be reached right now, so their state is unknown.': 'بعض الأجهزة في المسار لا يمكن الوصول إليها الآن، لذلك حالتها غير معروفة.',
        'The ONU is offline.': 'جهاز ONU غير متصل.',
        'Say what it connects to in the Link diagram to see the rest of the path.': 'حدد بماذا يتصل في مخطط الروابط لرؤية باقي المسار.',
        '✓ Claude Code on this PC is signed in.': '✓ Claude Code على هذا الكمبيوتر مسجَّل الدخول.',
        'With no key saved, Ask AI uses it (no key needed; it uses your Claude plan).': 'عند عدم حفظ مفتاح، يستخدمه زر اسأل الذكاء الاصطناعي (لا حاجة لمفتاح، ويستخدم خطة Claude الخاصة بك).',
        'Claude Code was found on this PC but is not signed in.': 'تم العثور على Claude Code على هذا الكمبيوتر لكنه غير مسجَّل الدخول.',
        'To use it instead of a key, open PowerShell, run this once, sign in with your Claude account in the browser, then reload this page:': 'لاستخدامه بدل المفتاح، افتح PowerShell ونفّذ هذا الأمر مرة واحدة، سجّل الدخول بحساب Claude في المتصفح، ثم أعد تحميل هذه الصفحة:',
        'Site cards': 'بطاقات المواقع', 'Link diagram': 'مخطط الروابط', 'Trace a customer': 'تتبّع عميل', 'Tree': 'شجرة',
        'Devices grouped by site': 'الأجهزة مرتبة حسب الموقع', 'What connects to what': 'ما يتصل بماذا',
        'Follow one customer to the internet': 'تتبّع عميل حتى الإنترنت', 'Grouped by role': 'مرتبة حسب الدور',
        'Not on a site yet': 'ليس على موقع بعد', 'Place on site': 'ضع على موقع', 'Remove from site': 'أزل من الموقع', 'Clear ticks': 'إلغاء التحديد',
        'Tick devices to place them on a site.': 'حدد الأجهزة لوضعها على موقع.',
        'None of your devices is on a site yet.': 'لا يوجد أي جهاز على موقع بعد.',
        'Site name, e.g. Hill tower': 'اسم الموقع، مثال: برج التل', 'Type a site name first.': 'اكتب اسم الموقع أولاً.',
        'Not connected yet': 'غير موصول بعد', '— not connected yet —': '— غير موصول بعد —', 'Connects to': 'يتصل بـ',
        'Internet': 'الإنترنت', 'Internet (top of the network)': 'الإنترنت (أعلى الشبكة)', 'Open in Monitoring': 'افتح في المراقبة',
        'Save': 'حفظ', 'Saving…': 'جارٍ الحفظ…', 'Find a customer': 'ابحث عن عميل',
        'Username, name, MAC, IP or serial': 'اسم المستخدم أو الاسم أو MAC أو IP أو الرقم التسلسلي',
        'Where does it go next?': 'إلى أين يذهب بعد ذلك؟', 'Open the link diagram': 'افتح مخطط الروابط',
        'Pick a customer above to see their path.': 'اختر عميلاً من الأعلى لرؤية مساره.',
        'client list not read': 'قائمة العملاء غير مقروءة', 'all good': 'كل شيء سليم', 'state unknown': 'الحالة غير معروفة',
        'Click a box to see it.': 'اضغط على مربع لعرضه.', 'Click a box to see it and change what it connects to.': 'اضغط على مربع لعرضه وتغيير ما يتصل به.',
        'Switch to Real data to change what connects to what.': 'انتقل إلى البيانات الحقيقية لتغيير ما يتصل بماذا.',
        'Sector': 'قطاع', 'Backhaul': 'رابط رئيسي', 'Router': 'راوتر', 'OLT': 'OLT',
        'Real data': 'بيانات حقيقية', 'Demo data': 'بيانات تجريبية',
        'Showing a sample tower. Click to go back to your real data.': 'تعرض برجاً تجريبياً. اضغط للعودة إلى بياناتك الحقيقية.',
        'Showing your real data. Click to switch to a sample tower for testing.': 'تعرض بياناتك الحقيقية. اضغط للتبديل إلى برج تجريبي للاختبار.',
        'Demo data: a sample tower for testing. Nothing here changes your real devices. Add Device, Alerts and Settings still use your real setup.': 'بيانات تجريبية: برج وهمي للاختبار. لا شيء هنا يغيّر أجهزتك الحقيقية. صفحات إضافة جهاز والتنبيهات والإعدادات ما زالت تستخدم إعداداتك الحقيقية.',
        'Advisor': 'المستشار', 'Check this sector': 'افحص هذا القطاع', 'Ask AI for advice': 'اطلب نصيحة الذكاء الاصطناعي',
        'AI advice': 'نصيحة الذكاء الاصطناعي', 'Likely causes': 'الأسباب المحتملة', 'To do by hand': 'يُنفَّذ يدوياً',
        'Proposed changes': 'التغييرات المقترحة', 'Setting': 'الإعداد', 'New': 'الجديد', 'Why': 'السبب', 'Risk': 'المخاطرة',
        'Frequency': 'التردد', 'Transmit power': 'قدرة الإرسال', 'Channel width': 'عرض القناة', 'by hand': 'يدوياً',
        'Apply ticked changes': 'طبّق التغييرات المحددة', 'Keep the change': 'أبقِ التغيير', 'Undo now': 'تراجع الآن',
        'Changed just now:': 'تم التغيير الآن:', 'Checking…': 'جارٍ الفحص…', 'Asking the AI…': 'جارٍ سؤال الذكاء الاصطناعي…',
        'Applying…': 'جارٍ التطبيق…', 'Keeping…': 'جارٍ الإبقاء…', 'Undoing…': 'جارٍ التراجع…',
        'Kept. The new values stay.': 'تم الإبقاء. القيم الجديدة باقية.', 'Undone. The old values are back.': 'تم التراجع. عادت القيم القديمة.',
        'Tick at least one change first.': 'حدد تغييراً واحداً على الأقل أولاً.',
        'The AI proposed no setting change for this sector.': 'لم يقترح الذكاء الاصطناعي أي تغيير في إعدادات هذا القطاع.',
        'The last change was not kept, so the radio put the old values back.': 'لم يتم إبقاء آخر تغيير، لذلك أعاد الراديو القيم القديمة.',
        'AI advisor': 'مستشار الذكاء الاصطناعي', 'Optional · needs internet': 'اختياري · يحتاج إنترنت', 'Anthropic API key': 'مفتاح Anthropic API',
        'Save key': 'حفظ المفتاح', 'Paste your key': 'الصق مفتاحك', 'Remove saved key': 'إزالة المفتاح المحفوظ',
        'Leave blank to keep the saved key': 'اتركه فارغاً للإبقاء على المفتاح المحفوظ',
        'The check reads this sector\'s live data and points at likely causes. AI advice is optional and needs a key in Settings.': 'يقرأ الفحص البيانات الحية لهذا القطاع ويشير إلى الأسباب المحتملة. نصيحة الذكاء الاصطناعي اختيارية وتحتاج مفتاحاً في الإعدادات.',
        'Test this radio (read-only)': 'اختبر هذا الراديو (قراءة فقط)', 'Checking the radio…': 'جارٍ فحص الراديو…', 'Ready': 'جاهز',
        'Experimental on Ubiquiti radios.': 'تجريبي على راديوهات Ubiquiti.',
        'Nothing is sent anywhere until you press Ask AI.': 'لا يُرسل شيء إلى أي مكان حتى تضغط اطلب نصيحة الذكاء الاصطناعي.'
    };
    Object.keys(AR_ADVISOR).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(AR, k)) AR[k] = AR_ADVISOR[k]; });

    var PATTERNS = [
        [/^(\d+) items?$/, function (m) { return m[1] + ' عنصر'; }],
        [/^and (\d+) more$/, function (m) { return 'و ' + m[1] + ' أخرى'; }],
        [/^Live · updated (\d+)s ago$/, function (m) { return 'مباشر · آخر تحديث قبل ' + m[1] + ' ث'; }],
        [/^Checked every (\d+) s · last 10 minutes shown$/, function (m) { return 'فحص كل ' + m[1] + ' ث · عرض آخر 10 دقائق'; }],
        [/^(\d+)% of devices$/, function (m) { return m[1] + '% من الأجهزة'; }],
        [/^(\d+)% of accounts$/, function (m) { return m[1] + '% من الحسابات'; }],
        [/^of (\d+) accounts$/, function (m) { return 'من ' + m[1] + ' حساب'; }],
        [/^(\d+) online$/, function (m) { return m[1] + ' متصل'; }],
        [/^(\d+) offline$/, function (m) { return m[1] + ' غير متصل'; }],
        [/^(\d+) unknown$/, function (m) { return m[1] + ' غير معروف'; }],
        [/^(\d+) devices · grouped by role$/, function (m) { return m[1] + ' جهاز · مرتبة حسب الدور'; }],
        [/^Version (.+)$/, function (m) { return 'الإصدار ' + m[1]; }],
        [/^Source: (.+)$/, function (m) { return 'المصدر: ' + m[1]; }],
        [/^offline for (.+)$/, function (m) { return 'متوقف منذ ' + m[1]; }],
        [/^weak radio link: (.+)$/, function (m) { return 'إشارة ضعيفة: ' + m[1]; }],
        [/^weak link signal, (.+)$/, function (m) { return 'إشارة الرابط ضعيفة، ' + m[1]; }],
        [/^link at (\d+)% of its capacity$/, function (m) { return 'الرابط عند ' + m[1] + '% من سعته'; }],
        [/^CPU at (\d+)%$/, function (m) { return 'المعالج عند ' + m[1] + '%'; }],
        [/^Weak radio link: (.+)\.$/, function (m) { return 'رابط راديو ضعيف: ' + m[1] + '.'; }],
        [/^Weak fibre signal or a hot ONU: (.+)\.$/, function (m) { return 'إشارة ليف ضعيفة أو ONU ساخن: ' + m[1] + '.'; }],
        [/^(.+) is offline\. Everything behind it is affected\.$/, function (m) { return m[1] + ' غير متصل. كل ما خلفه متأثر.'; }],
        [/^The customer's PPPoE session is offline( although their radio is connected)?\.$/, function (m) { return 'جلسة PPPoE للعميل غير متصلة' + (m[1] ? ' رغم أن الراديو متصل' : '') + '.'; }],
        [/^(.+) needs attention\.$/, function (m) { return m[1] + ' يحتاج انتباه.'; }],
        [/^(\d+) min ago$/, function (m) { return 'قبل ' + m[1] + ' دقيقة'; }],
        [/^(\d+) s ago$/, function (m) { return 'قبل ' + m[1] + ' ث'; }],
        [/^Master end only$/, function () { return 'طرف الماستر فقط'; }],
        [/^Slave end only$/, function () { return 'طرف السلايف فقط'; }],
        [/^(\d+) selected$/, function (m) { return m[1] + ' محدد'; }],
        [/^(\d+) of (\d+) online$/, function (m) { return m[1] + ' من ' + m[2] + ' متصل'; }],
        [/^(\d+) need attention$/, function (m) { return m[1] + ' تحتاج انتباه'; }],
        [/^(\d+) devices?$/, function (m) { return m[1] + ' جهاز'; }],
        [/^(\d+) sectors?$/, function (m) { return m[1] + ' قطاع'; }],
        [/^(\d+) clients?$/, function (m) { return m[1] + ' عميل'; }],
        [/^(\d+) customers?(?: \((\d+) sectors? not read\))?$/, function (m) { return m[1] + ' عميل' + (m[2] ? ' (' + m[2] + ' قطاع غير مقروء)' : ''); }],
        [/^(\d+)\/(\d+) ONUs online$/, function (m) { return m[1] + '/' + m[2] + ' ONU متصل'; }],
        [/^Placed on (.+)\.$/, function (m) { return 'تم الوضع على ' + m[1] + '.'; }],
        [/^No customer matches “(.+)”\.$/, function (m) { return 'لا يوجد عميل يطابق “' + m[1] + '”.'; }],
        [/^Select (.+)$/, function (m) { return 'تحديد ' + m[1]; }],
        [/^weak fibre signal: (.+)$/, function (m) { return 'إشارة الليف ضعيفة: ' + m[1]; }],
        [/^(\d+) ONUs$/, function (m) { return m[1] + ' ONU'; }],
        [/^(\d+) ONUs on (.+)$/, function (m) { return m[1] + ' ONU على ' + m[2]; }],
        [/^(\d+) matched to a SAS user$/, function (m) { return m[1] + ' مطابقة لمستخدم SAS'; }],
        [/^(\d+) with weak light$/, function (m) { return m[1] + ' بإشارة ضوئية ضعيفة'; }],
        [/^showing the (\d+) weakest$/, function (m) { return 'عرض أضعف ' + m[1]; }],
        [/^(.+) \(([\d.]+)\) is not responding$/, function (m) { return m[1] + ' (' + m[2] + ') لا يستجيب'; }],
        [/^(.+) latency is high \((\d+) ms average\)$/, function (m) { return 'زمن استجابة ' + m[1] + ' مرتفع (المتوسط ' + m[2] + ' مللي ثانية)'; }],
        [/^Radios with no SAS user \((\d+)\)$/, function (m) { return 'راديوهات بلا مستخدم SAS (' + m[1] + ')'; }],
        [/^on (Sector .+|.+)$/, function (m) { return 'على ' + m[1]; }],
        [/^Select (.+)$/, function (m) { return 'تحديد ' + m[1]; }],
        [/^Remove (.+)$/, function (m) { return 'إزالة ' + m[1]; }],
        [/^Traffic, peak (.+)$/, function (m) { return 'الحركة، الذروة ' + m[1]; }],
        [/^peak (.+)$/, function (m) { return 'الذروة ' + m[1]; }],
        [/^Replies to ping \((\d+) ms\)$/, function (m) { return 'يرد على ping (' + m[1] + ' مللي ثانية)'; }],
        [/^Router login OK · (\d+) devices connected$/, function (m) { return 'دخول الراوتر ناجح · ' + m[1] + ' أجهزة متصلة'; }],
        [/^Reachable · (\d+) ms$/, function (m) { return 'قابل للوصول · ' + m[1] + ' مللي ثانية'; }]
    ];

    var ATTRS = ['placeholder', 'aria-label', 'title'];
    var SKIP = { SCRIPT: 1, STYLE: 1, PRE: 1, TEXTAREA: 1, CODE: 1 };
    var lang = 'en';
    var observer = null;

    function exact(text) {
        if (Object.prototype.hasOwnProperty.call(AR, text)) return AR[text];
        for (var i = 0; i < PATTERNS.length; i++) {
            var m = PATTERNS[i][0].exec(text);
            if (m) return PATTERNS[i][1](m);
        }
        return null;
    }
    function lookup(text) {
        var t = exact(text);
        if (t !== null) return t;
        // Leading icon / bullet / arrow, and a trailing colon or dash.
        var m = /^([^A-Za-z0-9\u0600-\u06FF(]+)([\s\S]*?)(\s*[:—·-]?\s*)$/.exec(text);
        if (m && m[2] && m[2] !== text) {
            t = exact(m[2]);
            if (t !== null) return m[1] + t + m[3];
        }
        // "a · b · c": each part on its own; only when at least one part is known.
        if (text.indexOf(' · ') !== -1) {
            var hit = false;
            var out = text.split(' · ').map(function (p) {
                var core = p.trim().replace(/\s*·$/, '');
                var r = core ? exact(core) : null;
                if (r === null) return p;
                hit = true;
                return p.replace(core, r);
            });
            if (hit) return out.join(' · ');
        }
        return null;
    }

    function textNode(node) {
        var p = node.parentNode;
        if (!p || SKIP[p.nodeName] || (p.closest && p.closest('.mono, .brand, .net-tools-out, [data-no-i18n]'))) return;
        var raw = node.nodeValue;
        if (lang === 'ar') {
            if (node._tdAr === raw) return; // already translated by us
            var core = raw.trim();
            if (!core) return;
            var t = lookup(core);
            if (t === null) return;
            node._tdEn = raw;
            node._tdAr = raw.replace(core, t);
            node.nodeValue = node._tdAr;
        } else if (node._tdEn !== undefined && node._tdAr === raw) {
            node.nodeValue = node._tdEn;
            node._tdEn = node._tdAr = undefined;
        }
    }

    function element(el) {
        if (el.nodeType !== 1 || SKIP[el.nodeName]) return;
        ATTRS.forEach(function (a) {
            if (!el.hasAttribute(a)) return;
            var cur = el.getAttribute(a), store = '_tdEn_' + a;
            if (lang === 'ar') {
                var t = lookup(cur.trim());
                if (t !== null) { el[store] = cur; el.setAttribute(a, t); }
            } else if (el[store] !== undefined) { el.setAttribute(a, el[store]); el[store] = undefined; }
        });
    }

    function walk(root) {
        if (root.nodeType === 3) { textNode(root); return; }
        if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
        element(root);
        var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
        var n;
        while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
    }

    function apply(next) {
        lang = next === 'ar' ? 'ar' : 'en';
        if (!document.body) return;
        walk(document.body);
        if (lang === 'ar' && !observer) {
            observer = new MutationObserver(function (list) {
                list.forEach(function (m) {
                    if (m.type === 'characterData') textNode(m.target);
                    else Array.prototype.forEach.call(m.addedNodes, walk);
                });
            });
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        } else if (lang !== 'ar' && observer) { observer.disconnect(); observer = null; }
    }

    window.TowerDesk.i18n = { apply: apply, size: Object.keys(AR).length };
    apply(document.documentElement.lang);
})();
