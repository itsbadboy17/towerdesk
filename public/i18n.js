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
        [/^CPU at (\d+)%$/, function (m) { return 'المعالج عند ' + m[1] + '%'; }]
    ];

    var ATTRS = ['placeholder', 'aria-label', 'title'];
    var SKIP = { SCRIPT: 1, STYLE: 1, PRE: 1, TEXTAREA: 1, CODE: 1 };
    var lang = 'en';
    var observer = null;

    function lookup(text) {
        if (Object.prototype.hasOwnProperty.call(AR, text)) return AR[text];
        for (var i = 0; i < PATTERNS.length; i++) {
            var m = PATTERNS[i][0].exec(text);
            if (m) return PATTERNS[i][1](m);
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
