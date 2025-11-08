const API_BASE = '';
let ec;
let currentLanguage = localStorage.getItem('language') || 'en';

const translations = {
    en: {
        'nav.logo': 'Kenostod Academy',
        'nav.subtitle': 'Blockchain Education Platform',
        'nav.courses': 'Courses',
        'nav.features': 'Features',
        'nav.docs': 'Documentation',
        'nav.stats': 'Live Stats',
        'nav.cta': 'Get Started',
        'hero.title': 'Master <span class="highlight">Blockchain Technology</span><br>Through Hands-On Learning',
        'hero.subtitle': 'The Complete Educational Platform for Future Blockchain Developers',
        'hero.tagline': 'Learn by doing with our comprehensive blockchain simulator featuring advanced concepts like <strong>Proof-of-Residual-Value consensus</strong>, <strong>transaction reversal</strong>, <strong>social recovery</strong>, and more. Perfect for students, developers, and entrepreneurs building their Web3 expertise in a safe, educational environment.',
        'hero.cta.free': 'Start Learning Free',
        'hero.cta.docs': 'View Documentation',
        'hero.cta.unlock': 'Unlock Full Access',
        'features.title': '✨ Platform Features',
        'features.subtitle': 'Everything you need to master blockchain development',
        'features.cta.title': 'Ready to Start Learning?',
        'features.cta.subtitle': 'Join thousands of students mastering the next generation of blockchain technology',
        'features.cta.button': 'View Subscription Plans',
        'courses.title': '📚 Complete Course Curriculum',
        'courses.subtitle': 'Master 15 revolutionary blockchain features not found in Bitcoin or Ethereum',
        'courses.intro': 'Each course includes hands-on simulation, real-world use cases, and practical exercises. These cutting-edge features represent the future of blockchain technology—learn them here first!',
        'ticker.supply': 'KENO Supply:',
        'ticker.blocks': 'Blocks:',
        'ticker.transactions': 'Transactions:',
        'ticker.loading': 'Loading crypto activity...',
        'badge.porv': 'PoRV Consensus',
        'badge.reversal': 'Transaction Reversal',
        'badge.scheduling': 'Smart Scheduling',
        'badge.recovery': 'Social Recovery',
        'badge.reputation': 'Reputation System',
        'badge.governance': 'Community Governance',
        'feature.courses.title': '15 Interactive Courses',
        'feature.courses.desc': 'Learn advanced blockchain concepts through hands-on simulation. Build real skills with features not found in Bitcoin or Ethereum.',
        'feature.porv.title': 'PoRV Mining System',
        'feature.porv.desc': 'Revolutionary Proof-of-Residual-Value consensus. Mine AI/ML jobs and earn perpetual royalties through RVT tokens—the future of mining.',
        'feature.reversal.title': 'Transaction Reversal',
        'feature.reversal.desc': 'Industry-first 5-minute reversal window prevents costly errors. A safety feature addressing the $40B+ problem in traditional blockchains.',
        'feature.scheduled.title': 'Smart Scheduled Payments',
        'feature.scheduled.desc': 'Native support for future-dated transactions. Built-in automation for recurring payments, escrows, and time-locked transfers.',
        'feature.recovery.title': 'Social Recovery',
        'feature.recovery.desc': 'Guardian-based wallet recovery system. Never lose access to your wallet—trusted contacts can help you recover your funds securely.',
        'feature.reputation.title': 'Reputation System',
        'feature.reputation.desc': 'Decentralized trust scores for wallets and merchants. Build credibility through verified transactions and community endorsements.',
        'feature.governance.title': 'Community Governance',
        'feature.governance.desc': 'Token holders vote on network parameters. Learn how DAOs work by participating in real blockchain governance decisions.',
        'feature.exchange.title': 'Full Exchange Platform',
        'feature.exchange.desc': 'Complete order book trading system with market/limit orders. Trade KENO against USD, BTC, and ETH pairs with real-time matching.',
        'feature.payment.title': 'Payment Gateway',
        'feature.payment.desc': 'Merchant-ready payment processing with QR codes, invoices, and automatic USD conversion. Build real-world e-commerce integrations.',
        'feature.fiat.title': 'Fiat Integration',
        'feature.fiat.desc': 'Stripe and PayPal connectivity for deposits and withdrawals. Bridge traditional finance with blockchain seamlessly.',
        'feature.explorer.title': 'Blockchain Explorer',
        'feature.explorer.desc': 'View the complete blockchain, transaction history, and wallet balances. Understand how explorers like Etherscan work.',
        'feature.analytics.title': 'Live Analytics',
        'feature.analytics.desc': 'Real-time network statistics, crypto market data, and transaction monitoring. Professional-grade dashboards and insights.',
        'feature.mobile.title': 'Mobile Ready',
        'feature.mobile.desc': 'Android and iOS app coming soon. Learn once, deploy everywhere with our cross-platform blockchain development approach.',
        'feature.security.title': 'Enterprise Security',
        'feature.security.desc': 'Industry-standard cryptography, multi-layer transaction validation, and client-side signing. Your private keys never leave your device.',
        'feature.docs.title': 'Complete Documentation',
        'feature.docs.desc': 'Over 75 API endpoints documented. Learn by reading production-grade code with detailed comments and examples.',
        'feature.graduate.title': 'Graduate Mining Program',
        'feature.graduate.desc': 'Professional plan students can apply for real mining grants. Turn your education into income through our revenue-sharing program.'
    },
    es: {
        'nav.logo': 'Academia Kenostod',
        'nav.subtitle': 'Plataforma de Educación Blockchain',
        'nav.courses': 'Cursos',
        'nav.features': 'Características',
        'nav.docs': 'Documentación',
        'nav.stats': 'Estadísticas en Vivo',
        'nav.cta': 'Comenzar',
        'hero.title': 'Domina la <span class="highlight">Tecnología Blockchain</span><br>Mediante Aprendizaje Práctico',
        'hero.subtitle': 'La Plataforma Educativa Completa para Futuros Desarrolladores Blockchain',
        'hero.tagline': 'Aprende haciendo con nuestro simulador blockchain integral que incluye conceptos avanzados como <strong>consenso Proof-of-Residual-Value</strong>, <strong>reversión de transacciones</strong>, <strong>recuperación social</strong>, y más. Perfecto para estudiantes, desarrolladores y emprendedores que construyen su experiencia Web3 en un entorno educativo seguro.',
        'hero.cta.free': 'Comenzar Gratis',
        'hero.cta.docs': 'Ver Documentación',
        'hero.cta.unlock': 'Desbloquear Acceso Completo',
        'features.title': '✨ Características de la Plataforma',
        'features.subtitle': 'Todo lo que necesitas para dominar el desarrollo blockchain',
        'features.cta.title': '¿Listo para Comenzar a Aprender?',
        'features.cta.subtitle': 'Únete a miles de estudiantes dominando la próxima generación de tecnología blockchain',
        'features.cta.button': 'Ver Planes de Suscripción',
        'courses.title': '📚 Plan de Estudios Completo',
        'courses.subtitle': 'Domina 15 características blockchain revolucionarias que no se encuentran en Bitcoin o Ethereum',
        'courses.intro': '¡Cada curso incluye simulación práctica, casos de uso del mundo real y ejercicios prácticos. Estas características de vanguardia representan el futuro de la tecnología blockchain, apréndalas aquí primero!',
        'ticker.supply': 'Suministro KENO:',
        'ticker.blocks': 'Bloques:',
        'ticker.transactions': 'Transacciones:',
        'ticker.loading': 'Cargando actividad cripto...',
        'badge.porv': 'Consenso PoRV',
        'badge.reversal': 'Reversión de Transacciones',
        'badge.scheduling': 'Programación Inteligente',
        'badge.recovery': 'Recuperación Social',
        'badge.reputation': 'Sistema de Reputación',
        'badge.governance': 'Gobernanza Comunitaria',
        'feature.courses.title': '15 Cursos Interactivos',
        'feature.courses.desc': 'Aprende conceptos blockchain avanzados mediante simulación práctica. Desarrolla habilidades reales con características no encontradas en Bitcoin o Ethereum.',
        'feature.porv.title': 'Sistema de Minería PoRV',
        'feature.porv.desc': 'Consenso revolucionario Proof-of-Residual-Value. Mina trabajos de IA/ML y gana regalías perpetuas a través de tokens RVT: el futuro de la minería.',
        'feature.reversal.title': 'Reversión de Transacciones',
        'feature.reversal.desc': 'Primera ventana de reversión de 5 minutos de la industria previene errores costosos. Una característica de seguridad que aborda el problema de $40B+ en blockchains tradicionales.',
        'feature.scheduled.title': 'Pagos Programados Inteligentes',
        'feature.scheduled.desc': 'Soporte nativo para transacciones con fecha futura. Automatización incorporada para pagos recurrentes, depósitos en garantía y transferencias bloqueadas por tiempo.',
        'feature.recovery.title': 'Recuperación Social',
        'feature.recovery.desc': 'Sistema de recuperación de billetera basado en guardianes. Nunca pierdas acceso a tu billetera: contactos de confianza pueden ayudarte a recuperar tus fondos de forma segura.',
        'feature.reputation.title': 'Sistema de Reputación',
        'feature.reputation.desc': 'Puntuaciones de confianza descentralizadas para billeteras y comerciantes. Construye credibilidad a través de transacciones verificadas y respaldos comunitarios.',
        'feature.governance.title': 'Gobernanza Comunitaria',
        'feature.governance.desc': 'Los poseedores de tokens votan sobre parámetros de red. Aprende cómo funcionan las DAOs participando en decisiones reales de gobernanza blockchain.',
        'feature.exchange.title': 'Plataforma de Intercambio Completa',
        'feature.exchange.desc': 'Sistema completo de libro de órdenes con órdenes de mercado/límite. Comercia KENO contra pares USD, BTC y ETH con coincidencia en tiempo real.',
        'feature.payment.title': 'Pasarela de Pagos',
        'feature.payment.desc': 'Procesamiento de pagos listo para comerciantes con códigos QR, facturas y conversión automática a USD. Construye integraciones de comercio electrónico del mundo real.',
        'feature.fiat.title': 'Integración Fiat',
        'feature.fiat.desc': 'Conectividad con Stripe y PayPal para depósitos y retiros. Conecta las finanzas tradicionales con blockchain sin problemas.',
        'feature.explorer.title': 'Explorador de Blockchain',
        'feature.explorer.desc': 'Ve la blockchain completa, historial de transacciones y saldos de billeteras. Comprende cómo funcionan exploradores como Etherscan.',
        'feature.analytics.title': 'Análisis en Vivo',
        'feature.analytics.desc': 'Estadísticas de red en tiempo real, datos de mercado cripto y monitoreo de transacciones. Paneles e información de grado profesional.',
        'feature.mobile.title': 'Listo para Móvil',
        'feature.mobile.desc': 'Aplicación Android e iOS próximamente. Aprende una vez, despliega en todas partes con nuestro enfoque de desarrollo blockchain multiplataforma.',
        'feature.security.title': 'Seguridad Empresarial',
        'feature.security.desc': 'Criptografía estándar de la industria, validación de transacciones de múltiples capas y firma del lado del cliente. Tus claves privadas nunca salen de tu dispositivo.',
        'feature.docs.title': 'Documentación Completa',
        'feature.docs.desc': 'Más de 75 endpoints de API documentados. Aprende leyendo código de grado de producción con comentarios detallados y ejemplos.',
        'feature.graduate.title': 'Programa de Minería para Graduados',
        'feature.graduate.desc': 'Los estudiantes del plan profesional pueden solicitar subvenciones de minería reales. Convierte tu educación en ingresos a través de nuestro programa de reparto de ingresos.'
    },
    zh: {
        'nav.logo': 'Kenostod学院',
        'nav.subtitle': '区块链教育平台',
        'nav.courses': '课程',
        'nav.features': '功能',
        'nav.docs': '文档',
        'nav.stats': '实时统计',
        'nav.cta': '开始使用',
        'hero.title': '通过实践学习<br>掌握<span class="highlight">区块链技术</span>',
        'hero.subtitle': '未来区块链开发者的完整教育平台',
        'hero.tagline': '通过我们全面的区块链模拟器边做边学，包含<strong>剩余价值证明共识</strong>、<strong>交易撤销</strong>、<strong>社交恢复</strong>等高级概念。非常适合在安全的教育环境中构建Web3专业知识的学生、开发人员和企业家。',
        'hero.cta.free': '免费开始学习',
        'hero.cta.docs': '查看文档',
        'hero.cta.unlock': '解锁完整访问',
        'features.title': '✨ 平台功能',
        'features.subtitle': '掌握区块链开发所需的一切',
        'features.cta.title': '准备好开始学习了吗？',
        'features.cta.subtitle': '加入数千名正在掌握下一代区块链技术的学生',
        'features.cta.button': '查看订阅计划',
        'courses.title': '📚 完整课程体系',
        'courses.subtitle': '掌握比特币或以太坊中找不到的15个革命性区块链功能',
        'courses.intro': '每门课程都包括实践模拟、实际应用案例和实践练习。这些尖端功能代表了区块链技术的未来——首先在这里学习！',
        'ticker.supply': 'KENO供应量：',
        'ticker.blocks': '区块：',
        'ticker.transactions': '交易：',
        'ticker.loading': '正在加载加密货币活动...',
        'badge.porv': 'PoRV共识',
        'badge.reversal': '交易撤销',
        'badge.scheduling': '智能调度',
        'badge.recovery': '社交恢复',
        'badge.reputation': '信誉系统',
        'badge.governance': '社区治理',
        'feature.courses.title': '15个互动课程',
        'feature.courses.desc': '通过实践模拟学习高级区块链概念。培养比特币或以太坊中没有的真实技能。',
        'feature.porv.title': 'PoRV挖矿系统',
        'feature.porv.desc': '革命性的剩余价值证明共识。挖掘AI/ML工作并通过RVT代币获得永久版税——挖矿的未来。',
        'feature.reversal.title': '交易撤销',
        'feature.reversal.desc': '业界首创的5分钟撤销窗口防止代价高昂的错误。解决传统区块链中400亿美元以上问题的安全功能。',
        'feature.scheduled.title': '智能定时支付',
        'feature.scheduled.desc': '原生支持未来日期交易。内置自动化功能，用于定期付款、托管和时间锁定转账。',
        'feature.recovery.title': '社交恢复',
        'feature.recovery.desc': '基于监护人的钱包恢复系统。永远不会失去对钱包的访问权限——可信联系人可以帮助您安全地恢复资金。',
        'feature.reputation.title': '信誉系统',
        'feature.reputation.desc': '钱包和商家的去中心化信任评分。通过经过验证的交易和社区认可建立信誉。',
        'feature.governance.title': '社区治理',
        'feature.governance.desc': '代币持有者投票决定网络参数。通过参与真实的区块链治理决策了解DAO的工作原理。',
        'feature.exchange.title': '完整交易平台',
        'feature.exchange.desc': '具有市价/限价订单的完整订单簿交易系统。与USD、BTC和ETH对实时匹配交易KENO。',
        'feature.payment.title': '支付网关',
        'feature.payment.desc': '具有二维码、发票和自动USD转换的商家支付处理。构建真实的电子商务集成。',
        'feature.fiat.title': '法币集成',
        'feature.fiat.desc': 'Stripe和PayPal连接用于存款和取款。无缝连接传统金融与区块链。',
        'feature.explorer.title': '区块链浏览器',
        'feature.explorer.desc': '查看完整的区块链、交易历史和钱包余额。了解Etherscan等浏览器的工作原理。',
        'feature.analytics.title': '实时分析',
        'feature.analytics.desc': '实时网络统计、加密市场数据和交易监控。专业级仪表板和洞察。',
        'feature.mobile.title': '移动就绪',
        'feature.mobile.desc': 'Android和iOS应用即将推出。通过我们的跨平台区块链开发方法一次学习，随处部署。',
        'feature.security.title': '企业安全',
        'feature.security.desc': '行业标准加密、多层交易验证和客户端签名。您的私钥永远不会离开您的设备。',
        'feature.docs.title': '完整文档',
        'feature.docs.desc': '记录了75多个API端点。通过阅读带有详细注释和示例的生产级代码来学习。',
        'feature.graduate.title': '毕业生挖矿计划',
        'feature.graduate.desc': '专业计划学生可以申请真实的挖矿补助金。通过我们的收入分享计划将您的教育转化为收入。'
    },
    hi: {
        'nav.logo': 'केनोस्टॉड अकादमी',
        'nav.subtitle': 'ब्लॉकचेन शिक्षा मंच',
        'nav.courses': 'पाठ्यक्रम',
        'nav.features': 'विशेषताएं',
        'nav.docs': 'दस्तावेज़ीकरण',
        'nav.stats': 'लाइव आंकड़े',
        'nav.cta': 'शुरू करें',
        'hero.title': 'व्यावहारिक शिक्षा के माध्यम से<br><span class="highlight">ब्लॉकचेन प्रौद्योगिकी</span> में महारत हासिल करें',
        'hero.subtitle': 'भविष्य के ब्लॉकचेन डेवलपर्स के लिए पूर्ण शैक्षिक मंच',
        'hero.tagline': 'हमारे व्यापक ब्लॉकचेन सिम्युलेटर के साथ करके सीखें जिसमें <strong>Proof-of-Residual-Value सर्वसम्मति</strong>, <strong>लेनदेन उलटना</strong>, <strong>सामाजिक पुनर्प्राप्ति</strong>, और अधिक जैसी उन्नत अवधारणाएं शामिल हैं। सुरक्षित शैक्षिक वातावरण में अपनी Web3 विशेषज्ञता का निर्माण करने वाले छात्रों, डेवलपर्स और उद्यमियों के लिए एकदम सही।',
        'hero.cta.free': 'मुफ्त में सीखना शुरू करें',
        'hero.cta.docs': 'दस्तावेज़ देखें',
        'hero.cta.unlock': 'पूर्ण पहुंच अनलॉक करें',
        'features.title': '✨ प्लेटफॉर्म विशेषताएं',
        'features.subtitle': 'ब्लॉकचेन विकास में महारत हासिल करने के लिए आपको जो कुछ भी चाहिए',
        'features.cta.title': 'सीखना शुरू करने के लिए तैयार हैं?',
        'features.cta.subtitle': 'ब्लॉकचेन प्रौद्योगिकी की अगली पीढ़ी में महारत हासिल करने वाले हजारों छात्रों के साथ जुड़ें',
        'features.cta.button': 'सदस्यता योजनाएं देखें',
        'courses.title': '📚 पूर्ण पाठ्यक्रम',
        'courses.subtitle': 'Bitcoin या Ethereum में नहीं पाई जाने वाली 15 क्रांतिकारी ब्लॉकचेन सुविधाओं में महारत हासिल करें',
        'courses.intro': 'प्रत्येक पाठ्यक्रम में व्यावहारिक सिमुलेशन, वास्तविक दुनिया के उपयोग के मामले और व्यावहारिक अभ्यास शामिल हैं। ये अत्याधुनिक सुविधाएं ब्लॉकचेन प्रौद्योगिकी के भविष्य का प्रतिनिधित्व करती हैं—उन्हें यहां पहले सीखें!',
        'ticker.supply': 'KENO आपूर्ति:',
        'ticker.blocks': 'ब्लॉक:',
        'ticker.transactions': 'लेनदेन:',
        'ticker.loading': 'क्रिप्टो गतिविधि लोड हो रही है...',
        'badge.porv': 'PoRV सर्वसम्मति',
        'badge.reversal': 'लेनदेन उलटना',
        'badge.scheduling': 'स्मार्ट शेड्यूलिंग',
        'badge.recovery': 'सामाजिक पुनर्प्राप्ति',
        'badge.reputation': 'प्रतिष्ठा प्रणाली',
        'badge.governance': 'सामुदायिक शासन',
        'feature.courses.title': '15 इंटरैक्टिव पाठ्यक्रम',
        'feature.courses.desc': 'व्यावहारिक सिमुलेशन के माध्यम से उन्नत ब्लॉकचेन अवधारणाओं को सीखें। Bitcoin या Ethereum में नहीं पाई जाने वाली सुविधाओं के साथ वास्तविक कौशल बनाएं।',
        'feature.porv.title': 'PoRV माइनिंग सिस्टम',
        'feature.porv.desc': 'क्रांतिकारी Proof-of-Residual-Value सर्वसम्मति। AI/ML कार्यों को माइन करें और RVT टोकन के माध्यम से स्थायी रॉयल्टी अर्जित करें—माइनिंग का भविष्य।',
        'feature.reversal.title': 'लेनदेन उलटना',
        'feature.reversal.desc': 'उद्योग की पहली 5-मिनट की उलटने की विंडो महंगी त्रुटियों को रोकती है। पारंपरिक ब्लॉकचेन में $40B+ समस्या को संबोधित करने वाली सुरक्षा सुविधा।',
        'feature.scheduled.title': 'स्मार्ट शेड्यूल्ड पेमेंट्स',
        'feature.scheduled.desc': 'भविष्य-दिनांकित लेनदेन के लिए देशी समर्थन। आवर्ती भुगतान, एस्क्रो और समय-लॉक किए गए हस्तांतरण के लिए अंतर्निहित स्वचालन।',
        'feature.recovery.title': 'सामाजिक पुनर्प्राप्ति',
        'feature.recovery.desc': 'अभिभावक-आधारित वॉलेट पुनर्प्राप्ति प्रणाली। अपने वॉलेट तक पहुंच कभी न खोएं—विश्वसनीय संपर्क आपको अपनी धनराशि सुरक्षित रूप से पुनर्प्राप्त करने में मदद कर सकते हैं।',
        'feature.reputation.title': 'प्रतिष्ठा प्रणाली',
        'feature.reputation.desc': 'वॉलेट और व्यापारियों के लिए विकेंद्रीकृत विश्वास स्कोर। सत्यापित लेनदेन और सामुदायिक समर्थन के माध्यम से विश्वसनीयता बनाएं।',
        'feature.governance.title': 'सामुदायिक शासन',
        'feature.governance.desc': 'टोकन धारक नेटवर्क पैरामीटर पर मतदान करते हैं। वास्तविक ब्लॉकचेन शासन निर्णयों में भाग लेकर सीखें कि DAO कैसे काम करते हैं।',
        'feature.exchange.title': 'पूर्ण एक्सचेंज प्लेटफॉर्म',
        'feature.exchange.desc': 'बाजार/सीमा आदेशों के साथ पूर्ण ऑर्डर बुक ट्रेडिंग सिस्टम। वास्तविक समय मिलान के साथ USD, BTC और ETH जोड़े के खिलाफ KENO का व्यापार करें।',
        'feature.payment.title': 'पेमेंट गेटवे',
        'feature.payment.desc': 'QR कोड, चालान और स्वचालित USD रूपांतरण के साथ व्यापारी-तैयार भुगतान प्रसंस्करण। वास्तविक दुनिया के ई-कॉमर्स एकीकरण बनाएं।',
        'feature.fiat.title': 'फिएट एकीकरण',
        'feature.fiat.desc': 'जमा और निकासी के लिए Stripe और PayPal कनेक्टिविटी। पारंपरिक वित्त को ब्लॉकचेन के साथ निर्बाध रूप से ब्रिज करें।',
        'feature.explorer.title': 'ब्लॉकचेन एक्सप्लोरर',
        'feature.explorer.desc': 'संपूर्ण ब्लॉकचेन, लेनदेन इतिहास और वॉलेट बैलेंस देखें। समझें कि Etherscan जैसे एक्सप्लोरर कैसे काम करते हैं।',
        'feature.analytics.title': 'लाइव एनालिटिक्स',
        'feature.analytics.desc': 'वास्तविक समय नेटवर्क आंकड़े, क्रिप्टो बाजार डेटा और लेनदेन निगरानी। पेशेवर-ग्रेड डैशबोर्ड और अंतर्दृष्टि।',
        'feature.mobile.title': 'मोबाइल तैयार',
        'feature.mobile.desc': 'Android और iOS ऐप जल्द आ रहा है। हमारे क्रॉस-प्लेटफ़ॉर्म ब्लॉकचेन विकास दृष्टिकोण के साथ एक बार सीखें, हर जगह तैनात करें।',
        'feature.security.title': 'एंटरप्राइज़ सुरक्षा',
        'feature.security.desc': 'उद्योग-मानक क्रिप्टोग्राफी, बहु-परत लेनदेन सत्यापन और क्लाइंट-साइड हस्ताक्षर। आपकी निजी कुंजियाँ कभी भी आपके डिवाइस को नहीं छोड़तीं।',
        'feature.docs.title': 'पूर्ण दस्तावेज़ीकरण',
        'feature.docs.desc': '75 से अधिक API endpoints प्रलेखित। विस्तृत टिप्पणियों और उदाहरणों के साथ उत्पादन-ग्रेड कोड पढ़कर सीखें।',
        'feature.graduate.title': 'स्नातक माइनिंग कार्यक्रम',
        'feature.graduate.desc': 'पेशेवर योजना के छात्र वास्तविक माइनिंग अनुदान के लिए आवेदन कर सकते हैं। हमारे राजस्व-साझाकरण कार्यक्रम के माध्यम से अपनी शिक्षा को आय में बदलें।'
    },
    pt: {
        'nav.logo': 'Academia Kenostod',
        'nav.subtitle': 'Plataforma de Educação Blockchain',
        'nav.courses': 'Cursos',
        'nav.features': 'Recursos',
        'nav.docs': 'Documentação',
        'nav.stats': 'Estatísticas ao Vivo',
        'nav.cta': 'Começar',
        'hero.title': 'Domine a <span class="highlight">Tecnologia Blockchain</span><br>Através de Aprendizagem Prática',
        'hero.subtitle': 'A Plataforma Educacional Completa para Futuros Desenvolvedores Blockchain',
        'hero.tagline': 'Aprenda fazendo com nosso simulador blockchain abrangente apresentando conceitos avançados como <strong>consenso Proof-of-Residual-Value</strong>, <strong>reversão de transações</strong>, <strong>recuperação social</strong> e muito mais. Perfeito para estudantes, desenvolvedores e empreendedores construindo sua experiência Web3 em um ambiente educacional seguro.',
        'hero.cta.free': 'Começar a Aprender Grátis',
        'hero.cta.docs': 'Ver Documentação',
        'hero.cta.unlock': 'Desbloquear Acesso Completo',
        'features.title': '✨ Recursos da Plataforma',
        'features.subtitle': 'Tudo que você precisa para dominar o desenvolvimento blockchain',
        'features.cta.title': 'Pronto para Começar a Aprender?',
        'features.cta.subtitle': 'Junte-se a milhares de estudantes dominando a próxima geração da tecnologia blockchain',
        'features.cta.button': 'Ver Planos de Assinatura',
        'courses.title': '📚 Currículo Completo do Curso',
        'courses.subtitle': 'Domine 15 recursos blockchain revolucionários não encontrados no Bitcoin ou Ethereum',
        'courses.intro': 'Cada curso inclui simulação prática, casos de uso do mundo real e exercícios práticos. Esses recursos de ponta representam o futuro da tecnologia blockchain—aprenda-os aqui primeiro!',
        'ticker.supply': 'Fornecimento KENO:',
        'ticker.blocks': 'Blocos:',
        'ticker.transactions': 'Transações:',
        'ticker.loading': 'Carregando atividade cripto...',
        'badge.porv': 'Consenso PoRV',
        'badge.reversal': 'Reversão de Transações',
        'badge.scheduling': 'Agendamento Inteligente',
        'badge.recovery': 'Recuperação Social',
        'badge.reputation': 'Sistema de Reputação',
        'badge.governance': 'Governança Comunitária',
        'feature.courses.title': '15 Cursos Interativos',
        'feature.courses.desc': 'Aprenda conceitos blockchain avançados através de simulação prática. Construa habilidades reais com recursos não encontrados no Bitcoin ou Ethereum.',
        'feature.porv.title': 'Sistema de Mineração PoRV',
        'feature.porv.desc': 'Consenso revolucionário Proof-of-Residual-Value. Minere trabalhos de IA/ML e ganhe royalties perpétuos através de tokens RVT—o futuro da mineração.',
        'feature.reversal.title': 'Reversão de Transações',
        'feature.reversal.desc': 'Primeira janela de reversão de 5 minutos da indústria previne erros custosos. Um recurso de segurança que aborda o problema de $40B+ em blockchains tradicionais.',
        'feature.scheduled.title': 'Pagamentos Agendados Inteligentes',
        'feature.scheduled.desc': 'Suporte nativo para transações com data futura. Automação integrada para pagamentos recorrentes, cauções e transferências bloqueadas por tempo.',
        'feature.recovery.title': 'Recuperação Social',
        'feature.recovery.desc': 'Sistema de recuperação de carteira baseado em guardiões. Nunca perca o acesso à sua carteira—contatos confiáveis podem ajudá-lo a recuperar seus fundos com segurança.',
        'feature.reputation.title': 'Sistema de Reputação',
        'feature.reputation.desc': 'Pontuações de confiança descentralizadas para carteiras e comerciantes. Construa credibilidade através de transações verificadas e endossos da comunidade.',
        'feature.governance.title': 'Governança Comunitária',
        'feature.governance.desc': 'Detentores de tokens votam em parâmetros de rede. Aprenda como DAOs funcionam participando de decisões reais de governança blockchain.',
        'feature.exchange.title': 'Plataforma de Exchange Completa',
        'feature.exchange.desc': 'Sistema completo de livro de ordens com ordens de mercado/limite. Negocie KENO contra pares USD, BTC e ETH com correspondência em tempo real.',
        'feature.payment.title': 'Gateway de Pagamento',
        'feature.payment.desc': 'Processamento de pagamento pronto para comerciantes com códigos QR, faturas e conversão automática para USD. Construa integrações de e-commerce do mundo real.',
        'feature.fiat.title': 'Integração Fiat',
        'feature.fiat.desc': 'Conectividade Stripe e PayPal para depósitos e retiradas. Conecte finanças tradicionais com blockchain perfeitamente.',
        'feature.explorer.title': 'Explorador de Blockchain',
        'feature.explorer.desc': 'Veja a blockchain completa, histórico de transações e saldos de carteira. Entenda como exploradores como Etherscan funcionam.',
        'feature.analytics.title': 'Análise ao Vivo',
        'feature.analytics.desc': 'Estatísticas de rede em tempo real, dados de mercado cripto e monitoramento de transações. Painéis e insights de nível profissional.',
        'feature.mobile.title': 'Pronto para Móvel',
        'feature.mobile.desc': 'Aplicativo Android e iOS em breve. Aprenda uma vez, implante em qualquer lugar com nossa abordagem de desenvolvimento blockchain multiplataforma.',
        'feature.security.title': 'Segurança Empresarial',
        'feature.security.desc': 'Criptografia padrão da indústria, validação de transação em múltiplas camadas e assinatura do lado do cliente. Suas chaves privadas nunca saem do seu dispositivo.',
        'feature.docs.title': 'Documentação Completa',
        'feature.docs.desc': 'Mais de 75 endpoints de API documentados. Aprenda lendo código de nível de produção com comentários detalhados e exemplos.',
        'feature.graduate.title': 'Programa de Mineração para Graduados',
        'feature.graduate.desc': 'Estudantes do plano profissional podem solicitar subsídios de mineração reais. Transforme sua educação em renda através do nosso programa de compartilhamento de receita.'
    },
    fr: {
        'nav.logo': 'Académie Kenostod',
        'nav.subtitle': 'Plateforme d\'Éducation Blockchain',
        'nav.courses': 'Cours',
        'nav.features': 'Fonctionnalités',
        'nav.docs': 'Documentation',
        'nav.stats': 'Statistiques en Direct',
        'nav.cta': 'Commencer',
        'hero.title': 'Maîtrisez la <span class="highlight">Technologie Blockchain</span><br>par l\'Apprentissage Pratique',
        'hero.subtitle': 'La Plateforme Éducative Complète pour les Futurs Développeurs Blockchain',
        'hero.tagline': 'Apprenez en pratiquant avec notre simulateur blockchain complet présentant des concepts avancés comme le <strong>consensus Proof-of-Residual-Value</strong>, <strong>l\'inversion de transactions</strong>, <strong>la récupération sociale</strong>, et plus encore. Parfait pour les étudiants, développeurs et entrepreneurs développant leur expertise Web3 dans un environnement éducatif sûr.',
        'hero.cta.free': 'Commencer Gratuitement',
        'hero.cta.docs': 'Voir la Documentation',
        'hero.cta.unlock': 'Débloquer l\'Accès Complet',
        'features.title': '✨ Fonctionnalités de la Plateforme',
        'features.subtitle': 'Tout ce dont vous avez besoin pour maîtriser le développement blockchain',
        'features.cta.title': 'Prêt à Commencer à Apprendre?',
        'features.cta.subtitle': 'Rejoignez des milliers d\'étudiants maîtrisant la prochaine génération de technologie blockchain',
        'features.cta.button': 'Voir les Plans d\'Abonnement',
        'courses.title': '📚 Programme de Cours Complet',
        'courses.subtitle': 'Maîtrisez 15 fonctionnalités blockchain révolutionnaires introuvables dans Bitcoin ou Ethereum',
        'courses.intro': 'Chaque cours comprend une simulation pratique, des cas d\'utilisation réels et des exercices pratiques. Ces fonctionnalités de pointe représentent l\'avenir de la technologie blockchain—apprenez-les ici en premier!',
        'ticker.supply': 'Approvisionnement KENO:',
        'ticker.blocks': 'Blocs:',
        'ticker.transactions': 'Transactions:',
        'ticker.loading': 'Chargement de l\'activité crypto...',
        'badge.porv': 'Consensus PoRV',
        'badge.reversal': 'Inversion de Transactions',
        'badge.scheduling': 'Planification Intelligente',
        'badge.recovery': 'Récupération Sociale',
        'badge.reputation': 'Système de Réputation',
        'badge.governance': 'Gouvernance Communautaire',
        'feature.courses.title': '15 Cours Interactifs',
        'feature.courses.desc': 'Apprenez des concepts blockchain avancés par simulation pratique. Développez de vraies compétences avec des fonctionnalités introuvables dans Bitcoin ou Ethereum.',
        'feature.porv.title': 'Système de Minage PoRV',
        'feature.porv.desc': 'Consensus révolutionnaire Proof-of-Residual-Value. Minez des tâches IA/ML et gagnez des royalties perpétuelles via des tokens RVT—l\'avenir du minage.',
        'feature.reversal.title': 'Inversion de Transactions',
        'feature.reversal.desc': 'Première fenêtre d\'inversion de 5 minutes de l\'industrie prévient les erreurs coûteuses. Une fonctionnalité de sécurité traitant le problème de $40B+ dans les blockchains traditionnelles.',
        'feature.scheduled.title': 'Paiements Programmés Intelligents',
        'feature.scheduled.desc': 'Support natif pour les transactions datées futures. Automatisation intégrée pour les paiements récurrents, les dépôts fiduciaires et les transferts verrouillés dans le temps.',
        'feature.recovery.title': 'Récupération Sociale',
        'feature.recovery.desc': 'Système de récupération de portefeuille basé sur les gardiens. Ne perdez jamais l\'accès à votre portefeuille—des contacts de confiance peuvent vous aider à récupérer vos fonds en toute sécurité.',
        'feature.reputation.title': 'Système de Réputation',
        'feature.reputation.desc': 'Scores de confiance décentralisés pour les portefeuilles et les marchands. Construisez votre crédibilité grâce aux transactions vérifiées et aux endorsements communautaires.',
        'feature.governance.title': 'Gouvernance Communautaire',
        'feature.governance.desc': 'Les détenteurs de tokens votent sur les paramètres réseau. Apprenez comment fonctionnent les DAOs en participant à de vraies décisions de gouvernance blockchain.',
        'feature.exchange.title': 'Plateforme d\'Exchange Complète',
        'feature.exchange.desc': 'Système complet de carnet d\'ordres avec ordres au marché/limite. Tradez KENO contre des paires USD, BTC et ETH avec correspondance en temps réel.',
        'feature.payment.title': 'Passerelle de Paiement',
        'feature.payment.desc': 'Traitement de paiement prêt pour les marchands avec codes QR, factures et conversion automatique en USD. Construisez des intégrations e-commerce réelles.',
        'feature.fiat.title': 'Intégration Fiat',
        'feature.fiat.desc': 'Connectivité Stripe et PayPal pour dépôts et retraits. Reliez la finance traditionnelle avec la blockchain de manière transparente.',
        'feature.explorer.title': 'Explorateur de Blockchain',
        'feature.explorer.desc': 'Visualisez la blockchain complète, l\'historique des transactions et les soldes de portefeuille. Comprenez comment fonctionnent les explorateurs comme Etherscan.',
        'feature.analytics.title': 'Analytiques en Direct',
        'feature.analytics.desc': 'Statistiques réseau en temps réel, données de marché crypto et surveillance des transactions. Tableaux de bord et insights de niveau professionnel.',
        'feature.mobile.title': 'Prêt pour Mobile',
        'feature.mobile.desc': 'Application Android et iOS bientôt disponible. Apprenez une fois, déployez partout avec notre approche de développement blockchain multiplateforme.',
        'feature.security.title': 'Sécurité d\'Entreprise',
        'feature.security.desc': 'Cryptographie standard de l\'industrie, validation de transaction multicouche et signature côté client. Vos clés privées ne quittent jamais votre appareil.',
        'feature.docs.title': 'Documentation Complète',
        'feature.docs.desc': 'Plus de 75 endpoints d\'API documentés. Apprenez en lisant du code de niveau production avec des commentaires détaillés et des exemples.',
        'feature.graduate.title': 'Programme de Minage pour Diplômés',
        'feature.graduate.desc': 'Les étudiants du plan professionnel peuvent postuler pour de vraies subventions de minage. Transformez votre éducation en revenus grâce à notre programme de partage des revenus.'
    }
};

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });
    
    const langText = document.getElementById('currentLangText');
    const langNames = {
        en: 'English',
        es: 'Español',
        zh: '中文',
        hi: 'हिन्दी',
        pt: 'Português',
        fr: 'Français'
    };
    if (langText) {
        langText.textContent = langNames[lang];
    }
    
    updateCryptoTicker();
}

function toggleLanguageDropdown() {
    const dropdown = document.getElementById('languageDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

window.onclick = function(event) {
    if (!event.target.matches('.lang-btn') && !event.target.matches('.current-lang')) {
        const dropdowns = document.getElementsByClassName('lang-dropdown-content');
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
};

// Mobile Menu Toggle
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('active');
    }
}

function initializeApp() {
    try {
        if (typeof elliptic === 'undefined') {
            console.error('Elliptic library not found');
            setTimeout(initializeApp, 500);
            return;
        }
        const EC = elliptic.ec;
        ec = new EC('secp256k1');
        console.log('✅ Cryptography library loaded successfully');
        switchLanguage(currentLanguage);
        loadStats();
        setInterval(loadStats, 10000);
        updateCryptoTicker();
        setInterval(updateCryptoTicker, 30000);
    } catch (error) {
        console.error('Failed to initialize:', error);
        setTimeout(initializeApp, 500);
    }
}

async function updateCryptoTicker() {
    try {
        const [statsResponse, pricesResponse, txResponse] = await Promise.all([
            fetch(`${API_BASE}/api/stats`),
            fetch(`${API_BASE}/api/crypto-prices`),
            fetch(`${API_BASE}/api/recent-transactions?limit=5`)
        ]);

        const stats = await statsResponse.json();
        const prices = await pricesResponse.json();
        const recentTx = await txResponse.json();

        let tickerHTML = '';

        // Add Kenostod stats
        const supplyLabel = translations[currentLanguage]['ticker.supply'] || 'KENO Supply:';
        const blocksLabel = translations[currentLanguage]['ticker.blocks'] || 'Blocks:';
        const txLabel = translations[currentLanguage]['ticker.transactions'] || 'Transactions:';
        
        tickerHTML += `
            <span class="ticker-item">
                <span class="ticker-emoji">⛓️</span>
                <span class="ticker-label">${supplyLabel}</span>
                <span class="ticker-value">${stats.supply?.circulatingSupply || 0}</span>
            </span>
            <span class="ticker-item">
                <span class="ticker-emoji">📦</span>
                <span class="ticker-label">${blocksLabel}</span>
                <span class="ticker-value">${stats.totalBlocks}</span>
            </span>
            <span class="ticker-item">
                <span class="ticker-emoji">💸</span>
                <span class="ticker-label">${txLabel}</span>
                <span class="ticker-value">${stats.totalTransactions}</span>
            </span>
        `;

        // Add crypto market prices with defensive guards
        const cryptoList = [
            { key: 'bitcoin', emoji: '₿', label: 'BTC' },
            { key: 'ethereum', emoji: 'Ξ', label: 'ETH' },
            { key: 'solana', emoji: '◎', label: 'SOL' },
            { key: 'cardano', emoji: '₳', label: 'ADA' },
            { key: 'ripple', emoji: '✕', label: 'XRP' },
            { key: 'polkadot', emoji: '●', label: 'DOT' },
            { key: 'dogecoin', emoji: 'Ð', label: 'DOGE' },
            { key: 'polygon', emoji: '⬡', label: 'MATIC' },
            { key: 'chainlink', emoji: '⬢', label: 'LINK' },
            { key: 'litecoin', emoji: 'Ł', label: 'LTC' }
        ];

        cryptoList.forEach(crypto => {
            if (prices[crypto.key] && prices[crypto.key].usd) {
                const price = Number(prices[crypto.key].usd) || 0;
                const change = Number(prices[crypto.key].usd_24h_change) || 0;
                const volume = prices[crypto.key].usd_24h_vol;
                const marketCap = prices[crypto.key].usd_market_cap;
                
                let priceDisplay = price >= 1 
                    ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` 
                    : `$${price.toFixed(6)}`;
                
                tickerHTML += `
                    <span class="ticker-item">
                        <span class="ticker-emoji">${crypto.emoji}</span>
                        <span class="ticker-label">${crypto.label}:</span>
                        <span class="ticker-value">${priceDisplay}</span>
                        <span class="ticker-value ${change >= 0 ? 'ticker-up' : 'ticker-down'}">
                            ${change >= 0 ? '↑' : '↓'}${Math.abs(change).toFixed(2)}%
                        </span>
                    </span>
                `;
                
                if (volume && crypto.label === 'BTC') {
                    const volDisplay = volume >= 1e9 
                        ? `$${(volume / 1e9).toFixed(2)}B` 
                        : volume >= 1e6 
                            ? `$${(volume / 1e6).toFixed(2)}M` 
                            : `$${(volume / 1e3).toFixed(2)}K`;
                    
                    tickerHTML += `
                        <span class="ticker-item">
                            <span class="ticker-emoji">📊</span>
                            <span class="ticker-label">BTC 24h Vol:</span>
                            <span class="ticker-value">${volDisplay}</span>
                        </span>
                    `;
                }
            }
        });

        // Add recent Kenostod transactions
        if (recentTx && recentTx.length > 0) {
            recentTx.slice(0, 3).forEach(tx => {
                tickerHTML += `
                    <span class="ticker-item">
                        <span class="ticker-emoji">💰</span>
                        <span class="ticker-label">${tx.from} → ${tx.to}:</span>
                        <span class="ticker-value">${tx.amount} KENO</span>
                    </span>
                `;
            });
        }

        // Create seamless infinite scroll by duplicating content
        const tickerContent = document.getElementById('tickerContent');
        tickerContent.innerHTML = tickerHTML + tickerHTML + tickerHTML;

    } catch (error) {
        console.error('Error updating ticker:', error);
        document.getElementById('tickerContent').innerHTML = `
            <span class="ticker-item">
                <span class="ticker-emoji">⛓️</span>
                <span class="ticker-label">Kenostod Blockchain</span>
                <span class="ticker-value">Live</span>
            </span>
        `;
    }
}

function ensureECLoaded() {
    if (!ec) {
        if (typeof elliptic !== 'undefined') {
            const EC = elliptic.ec;
            ec = new EC('secp256k1');
            console.log('EC initialized on demand');
        } else {
            throw new Error('Cryptography library not loaded. Please refresh the page and wait a moment before sending transactions.');
        }
    }
}

function openTab(button, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    const tabButtons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    button.classList.add('active');
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('totalBlocks').textContent = data.totalBlocks;
        document.getElementById('totalTransactions').textContent = data.totalTransactions;
        document.getElementById('difficulty').textContent = data.difficulty;
        document.getElementById('miningReward').textContent = `${data.miningReward} KENO`;
        document.getElementById('isValid').textContent = data.isValid ? '✅ Valid' : '❌ Invalid';
        
        if (data.supply) {
            document.getElementById('circulatingSupply').textContent = `${data.supply.circulatingSupply} KENO`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function createWallet() {
    try {
        const response = await fetch(`${API_BASE}/api/wallet/create`, {
            method: 'POST'
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('newWallet');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>New Wallet Created!</h4>
            <p><strong>Address:</strong> <code>${data.address}</code></p>
            <p><strong>Private Key:</strong> <code>${data.privateKey}</code></p>
            <p style="color: #dc3545; margin-top: 10px;">⚠️ ${data.warning}</p>
            <button onclick="useThisWallet('${data.address}', '${data.privateKey}')" class="btn btn-secondary" style="margin-top: 10px;">Use This Wallet</button>
        `;
    } catch (error) {
        showError('newWallet', error.message);
    }
}

async function importWallet() {
    const privateKey = document.getElementById('importPrivateKey').value.trim();
    
    if (!privateKey) {
        showError('importWallet', 'Please enter a private key');
        return;
    }
    
    try {
        const keyPair = ec.keyFromPrivate(privateKey, 'hex');
        const publicKey = keyPair.getPublic('hex');
        
        const response = await fetch(`${API_BASE}/api/balance/${publicKey}`);
        const data = await response.json();
        
        if (data.error) {
            showError('importWallet', data.error);
            return;
        }
        
        useThisWallet(publicKey, privateKey);
        
        const resultDiv = document.getElementById('importWallet');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>✅ Wallet Imported Successfully!</h4>
            <p><strong>Address:</strong> <code>${publicKey.substring(0, 20)}...</code></p>
            <p><strong>Balance:</strong> ${data.balance} KENO</p>
            <p style="color: var(--accent-green); margin-top: 10px;">Your wallet is now loaded and ready to use!</p>
        `;
        
        document.getElementById('importPrivateKey').value = '';
    } catch (error) {
        showError('importWallet', 'Invalid private key. Please check and try again.');
    }
}

function useThisWallet(address, privateKey) {
    document.getElementById('myAddress').value = address;
    document.getElementById('myPrivateKey').value = privateKey;
    
    document.getElementById('txFromAddress').value = address;
    document.getElementById('txPrivateKey').value = privateKey;
    
    document.getElementById('tradeWalletAddress').value = address;
    document.getElementById('tradePrivateKey').value = privateKey;
    
    alert('✅ Wallet loaded! You can now use it to send transactions and trade on the exchange.');
}

async function checkBalance() {
    const address = document.getElementById('balanceAddress').value;
    if (!address) {
        showError('balanceResult', 'Please enter an address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/balance/${address}`);
        const data = await response.json();
        
        if (data.error) {
            showError('balanceResult', data.error);
            return;
        }
        
        const resultDiv = document.getElementById('balanceResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Balance Information</h4>
            <p><strong>Address:</strong> <code>${data.address.substring(0, 20)}...</code></p>
            <p><strong>Balance:</strong> ${data.balance} ${data.token}</p>
        `;
    } catch (error) {
        showError('balanceResult', error.message);
    }
}

async function sendTransaction() {
    const fromAddress = document.getElementById('txFromAddress').value || document.getElementById('myAddress').value;
    const toAddress = document.getElementById('txToAddress').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const fee = parseFloat(document.getElementById('txFee').value);
    const message = document.getElementById('txMessage').value || '';
    const privateKey = document.getElementById('txPrivateKey').value || document.getElementById('myPrivateKey').value;
    
    if (!fromAddress || !toAddress || !amount || !privateKey) {
        showError('txResult', 'Please fill in all required fields');
        return;
    }
    
    try {
        // Use simple server-side signing endpoint
        const response = await fetch(`${API_BASE}/api/transaction/simple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAddress,
                toAddress,
                amount,
                fee,
                privateKey,
                message
            })
        });

        const data = await response.json();
        
        if (data.error) {
            showError('txResult', data.error);
            return;
        }
        
        const resultDiv = document.getElementById('txResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>✅ Transaction Created Successfully!</h4>
            <p><strong>Transaction Hash:</strong> <code>${data.transactionHash.substring(0, 20)}...</code></p>
            <p><strong>From:</strong> ${data.transaction.fromAddress.substring(0, 20)}...</p>
            <p><strong>To:</strong> ${data.transaction.toAddress.substring(0, 20)}...</p>
            <p><strong>Amount:</strong> ${data.transaction.amount} KENO</p>
            <p><strong>Fee:</strong> ${data.transaction.fee} KENO</p>
            ${message ? `<p><strong>Message:</strong> "${message}"</p>` : ''}
            <p style="color: #ff9800; font-weight: bold; margin-top: 15px;">⏱️ You have 5 MINUTES to cancel this transaction!</p>
            <p style="color: #666;">Go to "View Pending Transactions" to cancel it before it's mined into a block.</p>
        `;
        
        loadStats();
    } catch (error) {
        showError('txResult', error.message);
    }
}

async function loadPendingTransactions() {
    const address = document.getElementById('pendingAddress').value;
    if (!address) {
        showError('pendingTxList', 'Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/transaction/pending/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('pendingTxList');

        if (data.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No pending transactions found for this address.</p>';
            return;
        }

        let html = '<h4>Your Pending Transactions (5-Minute Reversal Window)</h4>';
        data.forEach(tx => {
            const timeRemaining = tx.timeRemaining || 0;
            const seconds = Math.floor(timeRemaining / 1000);
            const canCancel = tx.canBeCancelled && timeRemaining > 0;

            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>To:</strong> ${tx.toAddress.substring(0, 20)}...</p>
                    <p><strong>Amount:</strong> ${tx.amount} KENO</p>
                    <p><strong>Time Remaining:</strong> ${canCancel ? `⏱️ ${seconds}s` : '❌ Expired'}</p>
                    ${tx.message ? `<p><strong>Message:</strong> ${tx.message}</p>` : ''}
                    ${canCancel ? 
                        `<button onclick="cancelTransaction('${tx.hash}', '${address}')" class="btn btn-danger">🔄 Cancel Transaction</button>` :
                        '<p style="color: #888;">Cannot cancel (past 5-minute window)</p>'
                    }
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('pendingTxList', error.message);
    }
}

async function cancelTransaction(txHash, senderAddress) {
    if (!confirm('Are you sure you want to cancel this transaction?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/transaction/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionHash: txHash, senderAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Transaction cancelled successfully!');
        loadPendingTransactions();
        loadStats();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function toggleScheduleOptions() {
    const type = document.getElementById('schedType').value;
    document.getElementById('recurringOptions').style.display = type === 'recurring' ? 'block' : 'none';
}

async function createScheduledPayment() {
    const fromAddress = document.getElementById('schedFromAddress').value;
    const toAddress = document.getElementById('schedToAddress').value;
    const amount = parseFloat(document.getElementById('schedAmount').value);
    const fee = parseFloat(document.getElementById('schedFee').value);
    const type = document.getElementById('schedType').value;
    const startDate = new Date(document.getElementById('schedStartDate').value).getTime();
    const privateKey = document.getElementById('schedPrivateKey').value;

    if (!fromAddress || !toAddress || !amount || !privateKey || !startDate) {
        showError('schedResult', 'Please fill in all required fields');
        return;
    }

    let schedule;
    if (type === 'oneTime') {
        schedule = {
            type: 'oneTime',
            executeAt: startDate
        };
    } else {
        const interval = document.getElementById('schedInterval').value;
        const occurrences = parseInt(document.getElementById('schedOccurrences').value);
        schedule = {
            type: 'recurring',
            startDate: startDate,
            interval: interval,
            maxOccurrences: occurrences
        };
    }

    try {
        const timestamp = Date.now();
        const hashData = fromAddress + toAddress + amount + fee + JSON.stringify(schedule) + timestamp;
        const hashTx = CryptoJS.SHA256(hashData).toString();

        const key = ec.keyFromPrivate(privateKey, 'hex');
        const sig = key.sign(hashTx, 'base64');
        const signature = sig.toDER('hex');

        const scheduledTx = {
            fromAddress,
            toAddress,
            amount,
            fee,
            schedule,
            timestamp,
            signature
        };

        const response = await fetch(`${API_BASE}/api/scheduled/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduledTx)
        });

        const data = await response.json();

        if (data.error) {
            showError('schedResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('schedResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Scheduled Payment Created!</h4>
            <p><strong>Schedule ID:</strong> <code>${data.scheduleId}</code></p>
            <p><strong>Type:</strong> ${type}</p>
            <p>${data.message}</p>
        `;
    } catch (error) {
        showError('schedResult', error.message);
    }
}

async function viewScheduledPayments() {
    const address = document.getElementById('schedViewAddress').value;
    if (!address) {
        showError('schedList', 'Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/scheduled/list/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('schedList');

        if (data.scheduled.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No scheduled payments found.</p>';
            return;
        }

        let html = '<h4>Your Scheduled Payments</h4>';
        data.scheduled.forEach(sched => {
            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>To:</strong> ${sched.toAddress.substring(0, 20)}...</p>
                    <p><strong>Amount:</strong> ${sched.amount} KENO per payment</p>
                    <p><strong>Type:</strong> ${sched.schedule.type}</p>
                    <p><strong>Status:</strong> ${sched.status}</p>
                    ${sched.schedule.type === 'recurring' ? 
                        `<p><strong>Executed:</strong> ${sched.executionCount}/${sched.schedule.maxOccurrences}</p>` : 
                        ''}
                    ${sched.status === 'active' ? 
                        `<button onclick="cancelScheduledPayment('${sched.id}', '${address}')" class="btn btn-danger">Cancel</button>` :
                        ''}
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('schedList', error.message);
    }
}

async function cancelScheduledPayment(scheduleId, address) {
    if (!confirm('Cancel this scheduled payment?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/scheduled/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId, senderAddress: address })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Scheduled payment cancelled!');
        viewScheduledPayments();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function setupRecovery() {
    const walletAddress = document.getElementById('recoveryWalletAddress').value;
    const guardianInput = document.getElementById('guardianAddresses').value;
    const threshold = parseInt(document.getElementById('recoveryThreshold').value);

    if (!walletAddress || !guardianInput) {
        showError('recoverySetupResult', 'Please fill in all fields');
        return;
    }

    const guardians = guardianInput.split(',').map(g => g.trim()).filter(g => g);

    if (guardians.length < 2) {
        showError('recoverySetupResult', 'Minimum 2 guardians required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, guardians, threshold })
        });

        const data = await response.json();

        if (data.error) {
            showError('recoverySetupResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('recoverySetupResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Recovery System Setup!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Guardians:</strong> ${data.guardians.length}</p>
            <p><strong>Required Approvals:</strong> ${data.threshold}</p>
        `;
    } catch (error) {
        showError('recoverySetupResult', error.message);
    }
}

async function initiateRecovery() {
    const oldAddress = document.getElementById('lostAddress').value;
    const newAddress = document.getElementById('newAddress').value;
    const initiatorAddress = document.getElementById('initiatorAddress').value;

    if (!oldAddress || !newAddress || !initiatorAddress) {
        showError('recoveryInitResult', 'Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldAddress, newAddress, initiatorAddress })
        });

        const data = await response.json();

        if (data.error) {
            showError('recoveryInitResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('recoveryInitResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Recovery Request Initiated!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Request ID:</strong> <code>${data.request.id}</code></p>
            <p><strong>Required Approvals:</strong> ${data.request.threshold}</p>
            <p>Guardians have been notified. Request expires in 7 days.</p>
        `;
    } catch (error) {
        showError('recoveryInitResult', error.message);
    }
}

async function viewRecoveryRequests() {
    const guardianAddress = document.getElementById('guardianAddress').value;
    if (!guardianAddress) {
        showError('guardianRequests', 'Please enter your guardian address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/guardian/${guardianAddress}`);
        const data = await response.json();

        const resultDiv = document.getElementById('guardianRequests');

        if (data.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No recovery requests found.</p>';
            return;
        }

        let html = '<h4>Recovery Requests</h4>';
        data.forEach(req => {
            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>Request ID:</strong> ${req.id}</p>
                    <p><strong>Old Address:</strong> ${req.oldAddress.substring(0, 20)}...</p>
                    <p><strong>New Address:</strong> ${req.newAddress.substring(0, 20)}...</p>
                    <p><strong>Approvals:</strong> ${req.approvals}/${req.threshold}</p>
                    <p><strong>Status:</strong> ${req.status}</p>
                    ${req.status === 'pending' ? `
                        <button onclick="approveRecovery('${req.id}', '${guardianAddress}')" class="btn btn-primary">Approve</button>
                        <button onclick="rejectRecovery('${req.id}', '${guardianAddress}')" class="btn btn-danger">Reject</button>
                    ` : ''}
                    ${req.status === 'approved' ? `
                        <button onclick="executeRecovery('${req.id}')" class="btn btn-primary">Execute Recovery</button>
                    ` : ''}
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('guardianRequests', error.message);
    }
}

async function approveRecovery(requestId, guardianAddress) {
    try {
        const response = await fetch(`${API_BASE}/api/recovery/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, guardianAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery request approved!');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function rejectRecovery(requestId, guardianAddress) {
    try {
        const response = await fetch(`${API_BASE}/api/recovery/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, guardianAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery request rejected.');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function executeRecovery(requestId) {
    if (!confirm('Execute wallet recovery? This will transfer funds to the new address.')) return;

    try {
        const response = await fetch(`${API_BASE}/api/recovery/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery executed! Funds will be transferred when the next block is mined.');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function submitRating() {
    const txHash = document.getElementById('ratingTxHash').value;
    const raterAddress = document.getElementById('raterAddress').value;
    const rating = parseInt(document.getElementById('rating').value);
    const comment = document.getElementById('ratingComment').value || '';

    if (!txHash || !raterAddress) {
        showError('ratingResult', 'Please fill in required fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/reputation/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionHash: txHash, raterAddress, rating, comment })
        });

        const data = await response.json();

        if (data.error) {
            showError('ratingResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('ratingResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Rating Submitted!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Your Rating:</strong> ${'⭐'.repeat(rating)}</p>
        `;
    } catch (error) {
        showError('ratingResult', error.message);
    }
}

async function checkReputation() {
    const address = document.getElementById('repAddress').value;
    if (!address) {
        showError('repResult', 'Please enter an address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/reputation/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('repResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Reputation Score</h4>
            <p><strong>Address:</strong> ${address.substring(0, 20)}...</p>
            <p><strong>Average Rating:</strong> ${data.averageScore.toFixed(2)} ${'⭐'.repeat(Math.round(data.averageScore))}</p>
            <p><strong>Total Ratings:</strong> ${data.totalRatings}</p>
            <p><strong>Trust Level:</strong> ${data.trustLevel}</p>
            <p><strong>Rating Breakdown:</strong></p>
            <ul>
                ${Object.entries(data.breakdown).map(([stars, count]) => `<li>${stars} stars: ${count}</li>`).join('')}
            </ul>
        `;
    } catch (error) {
        showError('repResult', error.message);
    }
}

async function viewTopRated() {
    try {
        const response = await fetch(`${API_BASE}/api/reputation/top?limit=10`);
        const data = await response.json();

        const resultDiv = document.getElementById('topRated');

        if (data.topRated.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No rated addresses yet.</p>';
            return;
        }

        let html = '<h4>🏆 Top 10 Most Trusted Addresses</h4><ol>';
        data.topRated.forEach((item, index) => {
            html += `
                <li style="margin: 10px 0;">
                    <strong>${item.address.substring(0, 20)}...</strong><br>
                    Average: ${item.averageScore.toFixed(2)} ${'⭐'.repeat(Math.round(item.averageScore))} 
                    (${item.totalRatings} ratings) - ${item.trustLevel}
                </li>
            `;
        });
        html += '</ol>';

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('topRated', error.message);
    }
}

function updateParameterInfo() {
    const param = document.getElementById('proposalParameter').value;
    const infoElement = document.getElementById('parameterInfo');
    
    if (param === 'miningReward') {
        infoElement.textContent = 'Enter value between 0 and 1000 KENO';
    } else if (param === 'difficulty') {
        infoElement.textContent = 'Enter value between 1 and 10';
    } else if (param === 'minimumFee') {
        infoElement.textContent = 'Enter value between 0 and 10 KENO';
    }
}

async function createProposal() {
    const proposerAddress = document.getElementById('proposerAddress').value;
    const title = document.getElementById('proposalTitle').value;
    const description = document.getElementById('proposalDescription').value;
    const parameterName = document.getElementById('proposalParameter').value;
    const newValue = parseFloat(document.getElementById('proposalValue').value);

    if (!proposerAddress || !title || !description || isNaN(newValue)) {
        showError('proposalResult', 'Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/governance/propose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposerAddress, title, description, parameterName, newValue })
        });

        const data = await response.json();

        if (data.error) {
            showError('proposalResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('proposalResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Proposal Created!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Proposal ID:</strong> ${data.proposal.id}</p>
            <p><strong>Title:</strong> ${data.proposal.title}</p>
            <p>Voting period: 7 days</p>
        `;
    } catch (error) {
        showError('proposalResult', error.message);
    }
}

async function viewActiveProposals() {
    try {
        const response = await fetch(`${API_BASE}/api/governance/proposals/active`);
        const data = await response.json();

        const resultDiv = document.getElementById('activeProposals');

        if (data.proposals.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No active proposals.</p>';
            return;
        }

        let html = '<h4>Active Proposals</h4>';
        data.proposals.forEach(prop => {
            const timeLeft = Math.max(0, prop.expiresAt - Date.now());
            const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <h4>${prop.title}</h4>
                    <p><strong>ID:</strong> ${prop.id}</p>
                    <p><strong>Description:</strong> ${prop.description}</p>
                    <p><strong>Parameter:</strong> ${prop.parameterName}</p>
                    <p><strong>Current Value:</strong> ${prop.currentValue} → <strong>Proposed:</strong> ${prop.newValue}</p>
                    <p><strong>Time Remaining:</strong> ${daysLeft}d ${hoursLeft}h</p>
                    <p><strong>Yes Votes:</strong> ${prop.yesVotingPower} | <strong>No Votes:</strong> ${prop.noVotingPower}</p>
                    <div style="margin-top: 10px;">
                        <input type="text" id="voterAddr_${prop.id}" placeholder="Your address" class="input-field" style="margin-bottom: 5px;">
                        <button onclick="voteOnProposal('${prop.id}', 'yes')" class="btn btn-primary" style="margin-right: 5px;">Vote YES</button>
                        <button onclick="voteOnProposal('${prop.id}', 'no')" class="btn btn-danger">Vote NO</button>
                    </div>
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('activeProposals', error.message);
    }
}

async function voteOnProposal(proposalId, vote) {
    const voterAddress = document.getElementById(`voterAddr_${proposalId}`).value;
    
    if (!voterAddress) {
        alert('Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/governance/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId, voterAddress, vote })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert(`Vote cast: ${vote.toUpperCase()}!`);
        viewActiveProposals();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function viewGovernanceStats() {
    try {
        const response = await fetch(`${API_BASE}/api/governance/stats`);
        const data = await response.json();

        const resultDiv = document.getElementById('govStats');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Governance Statistics</h4>
            <p><strong>Total Proposals:</strong> ${data.totalProposals}</p>
            <p><strong>Active Proposals:</strong> ${data.activeProposals}</p>
            <p><strong>Approved:</strong> ${data.approvedProposals}</p>
            <p><strong>Rejected:</strong> ${data.rejectedProposals}</p>
            <p><strong>Executed:</strong> ${data.executedProposals}</p>
            <p><strong>Voting Period:</strong> ${data.votingPeriodDays} days</p>
            <p><strong>Minimum Participation:</strong> ${data.minimumParticipation}</p>
            <p><strong>Approval Threshold:</strong> ${data.approvalThreshold}</p>
        `;
    } catch (error) {
        showError('govStats', error.message);
    }
}

async function mineBlock() {
    const minerAddress = document.getElementById('minerAddress').value || document.getElementById('myAddress').value;
    
    if (!minerAddress) {
        showError('miningResult', 'Please enter a miner address');
        return;
    }
    
    const resultDiv = document.getElementById('miningResult');
    resultDiv.className = 'result';
    resultDiv.innerHTML = '<p class="loading">⛏️ Mining in progress... Please wait...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minerAddress })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError('miningResult', data.error);
            return;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Block Mined Successfully!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Your Balance:</strong> ${data.balance} KENO</p>
            <p><strong>Block Height:</strong> ${data.blockHeight}</p>
        `;
        
        loadStats();
    } catch (error) {
        showError('miningResult', error.message);
    }
}

async function loadBlockchain() {
    const resultDiv = document.getElementById('blockchainData');
    resultDiv.innerHTML = '<p class="loading">Loading blockchain...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/blockchain`);
        const data = await response.json();
        
        let html = '';
        data.chain.forEach((block, index) => {
            html += `
                <div class="block-item">
                    <h4>Block #${index}</h4>
                    <p><strong>Hash:</strong> <code>${block.hash}</code></p>
                    <p><strong>Previous Hash:</strong> <code>${block.previousHash}</code></p>
                    <p><strong>Timestamp:</strong> ${new Date(block.timestamp).toLocaleString()}</p>
                    <p><strong>Nonce:</strong> ${block.nonce}</p>
                    <p><strong>Transactions:</strong> ${block.transactions.length}</p>
                    ${block.transactions.map(tx => `
                        <div class="transaction-item">
                            <strong>From:</strong> ${tx.fromAddress ? tx.fromAddress.substring(0, 20) + '...' : 'Mining Reward'}<br>
                            <strong>To:</strong> ${tx.toAddress.substring(0, 20)}...<br>
                            <strong>Amount:</strong> ${tx.amount} KENO<br>
                            ${tx.message ? `<strong>Message:</strong> ${tx.message}<br>` : ''}
                            <strong>Hash:</strong> <code>${tx.calculateHash ? tx.calculateHash() : 'N/A'}</code>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('blockchainData', 'Error loading blockchain: ' + error.message);
    }
}

async function loadTransactions() {
    const address = document.getElementById('historyAddress').value;
    if (!address) {
        showError('transactionHistory', 'Please enter an address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/transactions/${address}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('transactionHistory');
        
        if (data.transactions.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No transactions found for this address.</p>';
            return;
        }
        
        let html = '<h4>Transaction History</h4>';
        data.transactions.forEach(tx => {
            html += `
                <div class="transaction-item">
                    <strong>From:</strong> ${tx.fromAddress || 'Mining Reward'}<br>
                    <strong>To:</strong> ${tx.toAddress}<br>
                    <strong>Amount:</strong> ${tx.amount} KENO<br>
                    <strong>Fee:</strong> ${tx.fee} KENO<br>
                    ${tx.message ? `<strong>Message:</strong> ${tx.message}<br>` : ''}
                    <strong>Timestamp:</strong> ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('transactionHistory', error.message);
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.className = 'result error';
    element.innerHTML = `<p>❌ Error: ${message}</p>`;
}

async function togglePoRVMode() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/toggle`, {
            method: 'POST'
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('porvModeStatus');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>PoRV Mode Updated</h4>
            <p><strong>Status:</strong> ${data.enabled ? '🧠 PoRV Enabled' : '⛏️ PoW Enabled'}</p>
            <p>${data.enabled ? 'Mining now requires completing computational jobs for RVTs' : 'Mining uses traditional proof-of-work'}</p>
        `;
    } catch (error) {
        showError('porvModeStatus', error.message);
    }
}

async function loadComputationalJobs() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/jobs`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('jobsList');
        
        if (!data.jobs || data.jobs.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No computational jobs available. Create one in the Enterprise tab!</p>';
            return;
        }
        
        let html = '<h4>Available Computational Jobs</h4>';
        data.jobs.forEach(job => {
            html += `
                <div class="transaction-item">
                    <strong>Job ID:</strong> ${job.jobId}<br>
                    <strong>Type:</strong> ${job.jobType}<br>
                    <strong>Status:</strong> <span style="color: ${job.status === 'pending' ? '#f39c12' : job.status === 'completed' ? '#3498db' : '#2ecc71'}">${job.status.toUpperCase()}</span><br>
                    <strong>Upfront Fee:</strong> ${job.upfrontFee} KENO<br>
                    <strong>Royalty Rate:</strong> ${job.royaltyRate}%<br>
                    <strong>Client ID:</strong> ${job.clientId}<br>
                    ${job.rvtId ? `<strong>RVT Issued:</strong> ${job.rvtId}<br>` : ''}
                    <strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('jobsList', error.message);
    }
}

async function minePoRVBlock() {
    const minerAddress = document.getElementById('porvMinerAddress').value;
    const jobId = document.getElementById('porvJobId').value;
    
    if (!minerAddress) {
        showError('porvMiningResult', 'Please enter a miner address');
        return;
    }
    
    const resultDiv = document.getElementById('porvMiningResult');
    resultDiv.className = 'result';
    resultDiv.innerHTML = '<p>Mining PoRV block...</p>';
    
    try {
        const url = jobId ? `${API_BASE}/api/porv/mine/${jobId}` : `${API_BASE}/api/porv/mine`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minerAddress })
        });
        const data = await response.json();
        
        let html = '<h4>PoRV Block Mined Successfully!</h4>';
        if (data.job) {
            html += `
                <div class="transaction-item">
                    <strong>Job ID:</strong> ${data.job.jobId}<br>
                    <strong>Job Type:</strong> ${data.job.jobType}<br>
                    <strong>Upfront Fee Earned:</strong> ${data.job.upfrontFee} KENO<br>
                    <strong>Royalty Rate:</strong> ${data.job.royaltyRate}%
                </div>
            `;
        }
        
        if (data.rvt) {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <h4>💎 Residual Value Token Issued!</h4>
                    <strong>RVT ID:</strong> ${data.rvt.rvtId}<br>
                    <strong>Holder:</strong> ${data.rvt.holderAddress}<br>
                    <strong>Block Height:</strong> ${data.rvt.blockHeight}<br>
                    <strong>Status:</strong> ${data.rvt.isActive ? '✅ Active' : '❌ Inactive'}<br>
                    <p style="margin-top: 10px; color: #8e2de2; font-weight: 600;">
                        🎉 You now earn perpetual royalties from commercial usage of this computational work!
                    </p>
                </div>
            `;
        }
        
        if (data.block) {
            html += `
                <div class="transaction-item">
                    <strong>Block Hash:</strong> <code>${data.block.hash}</code><br>
                    <strong>Block Height:</strong> ${data.block.index || 'N/A'}<br>
                    <strong>Transactions:</strong> ${data.block.transactions?.length || 0}
                </div>
            `;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('porvMiningResult', error.message);
    }
}

async function loadPoRVStats() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('porvStats');
        let html = '<h4>PoRV System Statistics</h4>';
        html += `
            <div class="stats-grid">
                <div class="transaction-item">
                    <strong>PoRV Mode:</strong> ${data.enabled ? '🧠 Enabled' : '⛏️ Disabled'}<br>
                    <strong>Total Jobs:</strong> ${data.totalJobs}<br>
                    <strong>Pending Jobs:</strong> ${data.pendingJobs}<br>
                    <strong>Completed Jobs:</strong> ${data.completedJobs}<br>
                    <strong>Deployed Jobs:</strong> ${data.deployedJobs}
                </div>
                <div class="transaction-item">
                    <strong>Total RVTs:</strong> ${data.totalRVTs}<br>
                    <strong>Active RVTs:</strong> ${data.activeRVTs}<br>
                    <strong>Total Royalties Collected:</strong> ${data.totalRoyalties?.toFixed(2) || 0} KENO<br>
                    <strong>Total Tokens Burned:</strong> ${data.totalBurned?.toFixed(2) || 0} KENO
                </div>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('porvStats', error.message);
    }
}

async function loadMyRVTs() {
    const holderAddress = document.getElementById('rvtHolderAddress').value;
    if (!holderAddress) {
        showError('rvtPortfolioList', 'Please enter your address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvts/holder/${holderAddress}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('rvtPortfolioList');
        
        if (!data.rvts || data.rvts.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No RVTs found for this address. Mine a PoRV block to earn one!</p>';
            return;
        }
        
        let html = `<h4>Your RVT Portfolio (${data.rvts.length} tokens)</h4>`;
        data.rvts.forEach(rvt => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <strong>RVT ID:</strong> ${rvt.rvtId}<br>
                    <strong>Job ID:</strong> ${rvt.jobId}<br>
                    <strong>Computation Type:</strong> ${rvt.computationType}<br>
                    <strong>Block Height:</strong> ${rvt.blockHeight}<br>
                    <strong>Status:</strong> ${rvt.isActive ? '✅ Active (Earning Royalties)' : '❌ Inactive'}<br>
                    <strong>Issued:</strong> ${new Date(rvt.issuedAt).toLocaleString()}<br>
                    ${rvt.totalRoyaltiesEarned ? `<strong>Total Royalties Earned:</strong> ${rvt.totalRoyaltiesEarned.toFixed(2)} KENO<br>` : ''}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('rvtPortfolioList', error.message);
    }
}

async function loadRVTDetails() {
    const rvtId = document.getElementById('rvtDetailsId').value;
    if (!rvtId) {
        showError('rvtDetailsResult', 'Please enter an RVT ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvt/${rvtId}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('rvtDetailsResult');
        let html = '<h4>RVT Details</h4>';
        html += `
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                <strong>RVT ID:</strong> ${data.rvt.rvtId}<br>
                <strong>Job ID:</strong> ${data.rvt.jobId}<br>
                <strong>Holder Address:</strong> ${data.rvt.holderAddress}<br>
                <strong>Computation Type:</strong> ${data.rvt.computationType}<br>
                <strong>Block Height:</strong> ${data.rvt.blockHeight}<br>
                <strong>Status:</strong> ${data.rvt.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Issued:</strong> ${new Date(data.rvt.issuedAt).toLocaleString()}<br>
                ${data.rvt.totalRoyaltiesEarned ? `<strong>Total Royalties Earned:</strong> ${data.rvt.totalRoyaltiesEarned.toFixed(2)} KENO<br>` : ''}
                ${data.rvt.metadata ? `<strong>Metadata:</strong> ${JSON.stringify(data.rvt.metadata)}<br>` : ''}
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('rvtDetailsResult', error.message);
    }
}

async function loadAllRVTs() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvts`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allRVTsList');
        
        if (!data.rvts || data.rvts.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No RVTs have been issued yet.</p>';
            return;
        }
        
        let html = `<h4>All Issued RVTs (${data.rvts.length} total)</h4>`;
        data.rvts.forEach(rvt => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <strong>RVT ID:</strong> ${rvt.rvtId}<br>
                    <strong>Holder:</strong> ${rvt.holderAddress?.substring(0, 20)}...<br>
                    <strong>Type:</strong> ${rvt.computationType}<br>
                    <strong>Status:</strong> ${rvt.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('allRVTsList', error.message);
    }
}

async function registerEnterpriseClient() {
    const clientName = document.getElementById('clientName').value;
    const walletAddress = document.getElementById('clientWalletAddress').value;
    
    if (!clientName || !walletAddress) {
        showError('registerClientResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: clientName, walletAddress })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('registerClientResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Enterprise Client Registered Successfully!</h4>
            <div class="transaction-item">
                <strong>Client ID:</strong> ${data.client.clientId}<br>
                <strong>Name:</strong> ${data.client.name}<br>
                <strong>Wallet Address:</strong> ${data.client.walletAddress}<br>
                <strong>Status:</strong> ${data.client.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Registered:</strong> ${new Date(data.client.registeredAt).toLocaleString()}<br>
                <p style="margin-top: 10px; color: #3498db; font-weight: 600;">
                    Save your Client ID! You'll need it to create computational jobs.
                </p>
            </div>
        `;
    } catch (error) {
        showError('registerClientResult', error.message);
    }
}

async function createComputationalJob() {
    const clientId = document.getElementById('jobClientId').value;
    const jobType = document.getElementById('jobType').value;
    const parametersStr = document.getElementById('jobParameters').value;
    const upfrontFee = parseFloat(document.getElementById('jobUpfrontFee').value);
    const royaltyRate = parseFloat(document.getElementById('jobRoyaltyRate').value);
    const privateKey = document.getElementById('jobClientPrivateKey').value;
    
    if (!clientId || !parametersStr || !upfrontFee || !royaltyRate || !privateKey) {
        showError('createJobResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const parameters = JSON.parse(parametersStr);
        
        const clientResponse = await fetch(`${API_BASE}/api/porv/enterprise/client/${clientId}`);
        const clientData = await clientResponse.json();
        const clientWallet = clientData.client.walletAddress;
        
        const tempJobId = 'TEMP_' + Date.now();
        const escrowAddress = 'JOB_ESCROW_' + tempJobId;
        
        const escrowPayment = await signTransaction(
            clientWallet,
            escrowAddress,
            upfrontFee,
            1,
            `Job escrow payment for ${jobType}`,
            privateKey
        );
        
        const response = await fetch(`${API_BASE}/api/porv/enterprise/job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId,
                jobType,
                parameters,
                upfrontFee,
                royaltyRate,
                escrowPaymentTx: escrowPayment
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('createJobResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Computational Job Created Successfully!</h4>
            <div class="transaction-item">
                <strong>Job ID:</strong> ${data.job.jobId}<br>
                <strong>Type:</strong> ${data.job.jobType}<br>
                <strong>Status:</strong> ${data.job.status.toUpperCase()}<br>
                <strong>Upfront Fee:</strong> ${data.job.upfrontFee} KENO (escrowed)<br>
                <strong>Royalty Rate:</strong> ${data.job.royaltyRate}%<br>
                <strong>Escrow Address:</strong> ${data.job.escrowAddress}<br>
                <p style="margin-top: 10px; color: #2ecc71; font-weight: 600;">
                    ✅ Escrow payment signed and verified! Job is now available for miners.
                </p>
            </div>
        `;
    } catch (error) {
        showError('createJobResult', error.message);
    }
}

async function recordAPIUsage() {
    const jobId = document.getElementById('usageJobId').value;
    const revenue = parseFloat(document.getElementById('usageRevenue').value);
    const privateKey = document.getElementById('usageClientPrivateKey').value;
    
    if (!jobId || !revenue || !privateKey) {
        showError('usageResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const jobResponse = await fetch(`${API_BASE}/api/porv/job/${jobId}`);
        const jobData = await jobResponse.json();
        
        const clientResponse = await fetch(`${API_BASE}/api/porv/enterprise/client/${jobData.job.clientId}`);
        const clientData = await clientResponse.json();
        const clientWallet = clientData.client.walletAddress;
        
        const royaltyAmount = Math.floor((revenue * jobData.job.royaltyRate) / 100);
        const royaltyPoolAddress = 'ROYALTY_POOL_' + jobId;
        
        const royaltyPayment = await signTransaction(
            clientWallet,
            royaltyPoolAddress,
            royaltyAmount,
            1,
            `Royalty payment for ${jobId}`,
            privateKey
        );
        
        const response = await fetch(`${API_BASE}/api/porv/api-usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                revenueGenerated: revenue,
                royaltyPaymentTx: royaltyPayment
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('usageResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>API Usage Recorded & Royalties Distributed!</h4>
            <div class="transaction-item">
                <strong>Revenue:</strong> $${revenue}<br>
                <strong>Royalty Amount:</strong> ${data.royalty} KENO<br>
                <strong>Distribution:</strong><br>
                &nbsp;&nbsp;• Miner (50%): ${data.distribution.minerPayout} KENO<br>
                &nbsp;&nbsp;• Burned (40%): ${data.distribution.burnAmount} KENO<br>
                &nbsp;&nbsp;• Treasury (10%): ${data.distribution.treasuryAmount} KENO<br>
                <p style="margin-top: 10px; color: #2ecc71; font-weight: 600;">
                    ✅ Royalty payment signed, verified, and automatically distributed!
                </p>
            </div>
        `;
    } catch (error) {
        showError('usageResult', error.message);
    }
}

async function viewEnterpriseClient() {
    const clientId = document.getElementById('viewClientId').value;
    if (!clientId) {
        showError('clientDashboard', 'Please enter a client ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/client/${clientId}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('clientDashboard');
        let html = '<h4>Enterprise Client Dashboard</h4>';
        html += `
            <div class="transaction-item">
                <strong>Client ID:</strong> ${data.client.clientId}<br>
                <strong>Name:</strong> ${data.client.name}<br>
                <strong>Wallet Address:</strong> ${data.client.walletAddress}<br>
                <strong>Status:</strong> ${data.client.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Jobs Created:</strong> ${data.client.jobsCreated?.length || 0}<br>
                <strong>Total Paid:</strong> ${data.client.totalPaid?.toFixed(2) || 0} KENO<br>
                <strong>Total Royalties:</strong> ${data.client.totalRoyalties?.toFixed(2) || 0} KENO<br>
                <strong>Registered:</strong> ${new Date(data.client.registeredAt).toLocaleString()}
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('clientDashboard', error.message);
    }
}

async function viewAllClients() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/clients`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allClientsList');
        
        if (!data.clients || data.clients.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No enterprise clients registered yet.</p>';
            return;
        }
        
        let html = `<h4>All Enterprise Clients (${data.clients.length} total)</h4>`;
        data.clients.forEach(client => {
            html += `
                <div class="transaction-item">
                    <strong>Client ID:</strong> ${client.clientId}<br>
                    <strong>Name:</strong> ${client.name}<br>
                    <strong>Jobs:</strong> ${client.jobsCreated?.length || 0}<br>
                    <strong>Total Paid:</strong> ${client.totalPaid?.toFixed(2) || 0} KENO<br>
                    <strong>Status:</strong> ${client.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('allClientsList', error.message);
    }
}

async function loadRoyaltyCollections() {
    const jobId = document.getElementById('royaltyJobId').value;
    
    try {
        const url = jobId 
            ? `${API_BASE}/api/porv/royalties/job/${jobId}`
            : `${API_BASE}/api/porv/royalties`;
        const response = await fetch(url);
        const data = await response.json();
        
        const resultDiv = document.getElementById('royaltyCollectionsList');
        
        if (!data.collections || data.collections.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No royalty collections found.</p>';
            return;
        }
        
        let html = `<h4>Royalty Collections (${data.collections.length} total)</h4>`;
        data.collections.forEach(collection => {
            html += `
                <div class="transaction-item">
                    <strong>Collection ID:</strong> ${collection.collectionId}<br>
                    <strong>Job ID:</strong> ${collection.jobId}<br>
                    <strong>RVT ID:</strong> ${collection.rvtId}<br>
                    <strong>Amount:</strong> ${collection.amount} KENO<br>
                    <strong>Source:</strong> ${collection.source}<br>
                    <strong>Status:</strong> ${collection.distributed ? '✅ Distributed' : '⏳ Pending'}<br>
                    <strong>Collected:</strong> ${new Date(collection.collectedAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('royaltyCollectionsList', error.message);
    }
}

async function loadBurnStats() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/burns/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('burnStats');
        let html = '<h4>Token Burn Statistics</h4>';
        html += `
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;">
                <strong>Total Burned:</strong> ${data.stats.totalBurned} KENO<br>
                <strong>Burn Count:</strong> ${data.stats.burnCount} burns<br>
                <strong>Last Burn:</strong> ${data.stats.lastBurnDate ? new Date(data.stats.lastBurnDate).toLocaleString() : 'Never'}<br>
                <strong>Burn Wallet:</strong> <code>${data.stats.burnAddress}</code><br>
                <p style="margin-top: 10px; color: #e74c3c; font-weight: 600;">
                    🔥 40% of all royalties are permanently burned, reducing total supply!
                </p>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('burnStats', error.message);
    }
}

async function loadBurnHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/burns`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('burnHistory');
        
        if (!data.burns || data.burns.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No burns recorded yet.</p>';
            return;
        }
        
        let html = `<h4>Burn History (${data.burns.length} total burns)</h4>`;
        data.burns.forEach(burn => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;">
                    <strong>Burn ID:</strong> ${burn.burnId}<br>
                    <strong>Amount:</strong> ${burn.amount} KENO<br>
                    <strong>Source:</strong> ${burn.source}<br>
                    <strong>Transaction Hash:</strong> <code>${burn.transactionHash || 'N/A'}</code><br>
                    <strong>Burned:</strong> ${new Date(burn.burnedAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('burnHistory', error.message);
    }
}

async function loadSupplyAnalytics() {
    try {
        const statsResponse = await fetch(`${API_BASE}/api/stats`);
        const statsData = await statsResponse.json();
        
        const porvResponse = await fetch(`${API_BASE}/api/porv/stats`);
        const porvData = await porvResponse.json();
        
        const resultDiv = document.getElementById('supplyAnalytics');
        const totalMinted = statsData.supply?.totalMinted || 0;
        const totalBurned = porvData.totalBurned || 0;
        const circulatingSupply = statsData.supply?.circulatingSupply || 0;
        const burnRate = totalMinted > 0 ? ((totalBurned / totalMinted) * 100).toFixed(2) : 0;
        
        let html = '<h4>Supply Analytics</h4>';
        html += `
            <div class="stats-grid">
                <div class="transaction-item">
                    <strong>Total Minted:</strong> ${totalMinted} KENO<br>
                    <strong>Total Burned:</strong> ${totalBurned} KENO<br>
                    <strong>Circulating Supply:</strong> ${circulatingSupply} KENO<br>
                    <strong>Burn Rate:</strong> ${burnRate}%
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                    <h4>Deflationary Impact</h4>
                    <p>Every royalty payment burns 40% of tokens permanently.</p>
                    <p>As more AI/ML models generate revenue, more tokens are burned.</p>
                    <p style="color: #2ecc71; font-weight: 600; margin-top: 10px;">
                        Result: Decreasing supply + Increasing demand = Higher value! 📈
                    </p>
                </div>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('supplyAnalytics', error.message);
    }
}

async function signTransaction(fromAddress, toAddress, amount, fee, message, privateKeyHex) {
    if (!ec) {
        throw new Error('Elliptic library not initialized');
    }
    
    const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
    const publicKey = keyPair.getPublic('hex');
    
    if (publicKey !== fromAddress) {
        throw new Error('Private key does not match from address');
    }
    
    const timestamp = Date.now();
    const txData = fromAddress + toAddress + amount + fee + message + timestamp;
    const hash = CryptoJS.SHA256(txData).toString();
    const signature = keyPair.sign(hash, 'hex').toDER('hex');
    
    return {
        fromAddress,
        toAddress,
        amount,
        fee,
        message,
        timestamp,
        signature
    };
}

async function registerMerchant() {
    const businessName = document.getElementById('merchantBusinessName').value;
    const walletAddress = document.getElementById('merchantWalletAddress').value;
    const contactEmail = document.getElementById('merchantEmail').value;
    const businessType = document.getElementById('merchantBusinessType').value;
    
    if (!businessName || !walletAddress || !contactEmail) {
        showError('merchantRegisterResult', 'Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/merchant/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessName, walletAddress, contactEmail, businessType })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('merchantRegisterResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Merchant Registered Successfully!</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                <strong>Merchant ID:</strong> ${data.merchant.merchantId}<br>
                <strong>Business Name:</strong> ${data.merchant.businessName}<br>
                <strong>Wallet Address:</strong> ${data.merchant.walletAddress}<br>
                <strong>API Key:</strong> ${data.merchant.apiKey}<br>
                <strong>Status:</strong> ${data.merchant.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <p style="margin-top: 10px; color: #2ecc71; font-weight: 600;">
                    🎉 Your merchant account is ready! Save your Merchant ID and API Key.
                </p>
            </div>
        `;
    } catch (error) {
        showError('merchantRegisterResult', error.message);
    }
}

async function createPaymentRequest() {
    const merchantId = document.getElementById('paymentMerchantId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const currency = document.getElementById('paymentCurrency').value;
    const description = document.getElementById('paymentDescription').value;
    const customerEmail = document.getElementById('paymentCustomerEmail').value;
    
    if (!merchantId || !amount || !description) {
        showError('paymentRequestResult', 'Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/payment/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                merchantId,
                amount,
                currency,
                description,
                customerEmail
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('paymentRequestResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Payment Request Created!</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                <strong>Payment ID:</strong> ${data.paymentRequest.paymentRequestId}<br>
                <strong>Amount (KENO):</strong> ${data.paymentRequest.amountKENO.toFixed(2)} KENO<br>
                <strong>Amount (USD):</strong> $${data.paymentRequest.amountUSD.toFixed(2)}<br>
                <strong>Description:</strong> ${data.paymentRequest.description}<br>
                <strong>Payment URL:</strong> ${data.paymentRequest.paymentUrl}<br>
                <strong>QR Code String:</strong> <code style="word-break: break-all;">${data.paymentRequest.qrCode.qrString}</code><br>
                <strong>Expires:</strong> ${new Date(data.paymentRequest.expiresAt).toLocaleString()}<br>
                <p style="margin-top: 10px; color: #3498db; font-weight: 600;">
                    📱 Share the payment URL or QR code with your customer!
                </p>
            </div>
        `;
    } catch (error) {
        showError('paymentRequestResult', error.message);
    }
}

async function viewMerchantStats() {
    const merchantId = document.getElementById('viewMerchantId').value;
    if (!merchantId) {
        showError('merchantDashboardResult', 'Please enter a merchant ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/merchant/${merchantId}/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('merchantDashboardResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Merchant Dashboard - ${data.merchant.businessName}</h4>
            <div class="transaction-item">
                <h5>Account Information</h5>
                <strong>Merchant ID:</strong> ${data.merchant.merchantId}<br>
                <strong>Business Type:</strong> ${data.merchant.businessType}<br>
                <strong>Wallet:</strong> ${data.merchant.walletAddress}<br>
                <strong>Email:</strong> ${data.merchant.contactEmail}<br>
                <strong>Status:</strong> ${data.merchant.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Registered:</strong> ${new Date(data.merchant.registeredAt).toLocaleString()}
            </div>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                <h5>Payment Statistics</h5>
                <strong>Total Payments:</strong> ${data.totalPayments}<br>
                <strong>Confirmed:</strong> ${data.confirmedPayments}<br>
                <strong>Pending:</strong> ${data.pendingPayments}<br>
                <strong>Last 30 Days:</strong> ${data.recentPayments30Days} payments<br>
                <strong>Revenue (30 Days):</strong> ${data.recentRevenue30DaysKENO.toFixed(2)} KENO ($${data.recentRevenue30DaysUSD.toFixed(2)})<br>
                <strong>Average Payment:</strong> ${data.averagePaymentKENO.toFixed(2)} KENO
            </div>
        `;
    } catch (error) {
        showError('merchantDashboardResult', error.message);
    }
}

async function viewAllMerchants() {
    try {
        const response = await fetch(`${API_BASE}/api/merchant/list/all`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allMerchantsResult');
        
        if (!data.merchants || data.merchants.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No merchants registered yet.</p>';
            return;
        }
        
        let html = `<h4>All Registered Merchants (${data.count})</h4>`;
        data.merchants.forEach(merchant => {
            html += `
                <div class="transaction-item">
                    <strong>Business:</strong> ${merchant.businessName}<br>
                    <strong>Merchant ID:</strong> ${merchant.merchantId}<br>
                    <strong>Type:</strong> ${merchant.businessType}<br>
                    <strong>Payments:</strong> ${merchant.paymentCount || 0}<br>
                    <strong>Total Revenue:</strong> ${merchant.totalRevenueKENO?.toFixed(2) || 0} KENO<br>
                    <strong>Status:</strong> ${merchant.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('allMerchantsResult', error.message);
    }
}

async function viewConversionRates() {
    try {
        const response = await fetch(`${API_BASE}/api/payment/conversion-rate`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('conversionRatesResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Current KENO Conversion Rates</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                <strong style="font-size: 1.2rem;">1 KENO = $${data.kenoToUSD.toFixed(4)} USD</strong><br>
                <strong style="font-size: 1.2rem;">1 USD = ${data.usdToKENO.toFixed(4)} KENO</strong><br>
                <p style="margin-top: 10px; color: #666;">
                    💡 Rates are automatically applied when creating payment requests in USD
                </p>
            </div>
        `;
    } catch (error) {
        showError('conversionRatesResult', error.message);
    }
}

async function viewTierBenefits() {
    try {
        const response = await fetch(`${API_BASE}/api/merchant/tiers`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('tierBenefitsResult');
        const tiers = data.tiers;
        
        let html = '<h4>Merchant Tier Benefits</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">';
        
        for (const [tierKey, tier] of Object.entries(tiers)) {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, ${tier.color}20, ${tier.color}10); border-left: 4px solid ${tier.color};">
                    <h5 style="color: ${tier.color}; margin-top: 0;">${tier.name} Tier</h5>
                    <div style="margin: 10px 0;">
                        <strong>Requirements:</strong> ${tier.minStake.toLocaleString()} - ${tier.maxStake === Infinity ? '∞' : tier.maxStake.toLocaleString()} KENO
                    </div>
                    <div style="margin: 10px 0;">
                        <strong>Benefits:</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            ${tier.perks.map(perk => `<li>${perk}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid ${tier.color}40;">
                        <strong>Transaction Fee:</strong> ${(tier.transactionFee * 100).toFixed(2)}%<br>
                        <strong>Cashback:</strong> ${(tier.cashbackRate * 100)}%<br>
                        <strong>Staking APY:</strong> ${(tier.stakingAPY * 100)}%
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('tierBenefitsResult', error.message);
    }
}

async function stakeMerchantKENO() {
    const merchantId = document.getElementById('stakeMerchantId').value;
    const amount = parseFloat(document.getElementById('stakeAmount').value);
    const merchantAddress = document.getElementById('stakeMerchantAddress').value;
    
    if (!merchantId || !amount || !merchantAddress) {
        showError('stakeResult', 'Please fill in all fields');
        return;
    }
    
    if (amount <= 0) {
        showError('stakeResult', 'Amount must be positive');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/merchant/stake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchantId, amount, merchantAddress })
        });
        const data = await response.json();
        
        if (!data.success) {
            showError('stakeResult', data.error);
            return;
        }
        
        const resultDiv = document.getElementById('stakeResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>KENO Staked Successfully!</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, ${data.stake.tierBenefits.color}20, ${data.stake.tierBenefits.color}10); border-left: 4px solid ${data.stake.tierBenefits.color};">
                <strong>Amount Staked:</strong> ${amount.toLocaleString()} KENO<br>
                <strong>Total Staked:</strong> ${data.stake.stakedAmount.toLocaleString()} KENO<br>
                <strong>Current Tier:</strong> ${data.stake.tier} <span style="color: ${data.stake.tierBenefits.color};">●</span><br>
                <strong>Transaction Fee:</strong> ${(data.stake.tierBenefits.transactionFee * 100).toFixed(2)}%<br>
                <strong>Cashback Rate:</strong> ${(data.stake.tierBenefits.cashbackRate * 100)}%<br>
                <strong>Staking APY:</strong> ${(data.stake.tierBenefits.stakingAPY * 100)}%<br>
                <p style="margin-top: 10px; color: ${data.stake.tierBenefits.color}; font-weight: 600;">
                    ${data.message}
                </p>
            </div>
        `;
    } catch (error) {
        showError('stakeResult', error.message);
    }
}

async function viewMerchantIncentiveDashboard() {
    const merchantId = document.getElementById('stakeMerchantId').value;
    
    if (!merchantId) {
        showError('stakeResult', 'Please enter your Merchant ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/merchant/dashboard/${merchantId}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('stakeResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Merchant Rewards Dashboard</h4>
            
            <div class="transaction-item" style="background: linear-gradient(135deg, ${data.tierBenefits.color}20, ${data.tierBenefits.color}10); border-left: 4px solid ${data.tierBenefits.color};">
                <h5>Current Tier: ${data.currentTier} <span style="color: ${data.tierBenefits.color};">●</span></h5>
                <strong>Staked Amount:</strong> ${data.staking.stakedAmount.toLocaleString()} KENO<br>
                <strong>Staking APY:</strong> ${(data.staking.stakingAPY * 100)}%<br>
                <strong>Transaction Fee:</strong> ${(data.tierBenefits.transactionFee * 100).toFixed(2)}%<br>
                <strong>Cashback Rate:</strong> ${(data.tierBenefits.cashbackRate * 100)}%
            </div>
            
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                <h5>💰 Earnings Summary</h5>
                <strong>Available Rewards:</strong> ${data.rewards.available.toFixed(2)} KENO<br>
                <strong>Pending Staking Rewards:</strong> ${data.rewards.pending.toFixed(2)} KENO<br>
                <strong>Total Claimed:</strong> ${data.rewards.totalClaimed.toFixed(2)} KENO<br>
                <strong>Lifetime Earnings:</strong> ${data.rewards.lifetimeEarnings.toFixed(2)} KENO
            </div>
            
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(243, 156, 18, 0.1)); border-left: 4px solid #f39c12;">
                <h5>💎 Savings vs USD</h5>
                <strong>Your KENO Fee:</strong> ${data.benefits.savingsVsUSD.kenoFee}<br>
                <strong>Typical USD Fee:</strong> ${data.benefits.savingsVsUSD.usdFee}<br>
                <strong>Savings:</strong> ${data.benefits.savingsVsUSD.savingsPercent}<br>
                <strong>On $10K Sales:</strong> Save ${data.benefits.savingsVsUSD.on10kSales}
            </div>
            
            ${data.nextTier ? `
                <div class="transaction-item">
                    <h5>🎯 Next Tier: ${data.nextTier.name}</h5>
                    <strong>Required Stake:</strong> ${data.nextTier.requiredStake.toLocaleString()} KENO<br>
                    <strong>Need:</strong> ${(data.nextTier.requiredStake - data.staking.stakedAmount).toLocaleString()} more KENO
                </div>
            ` : '<div class="transaction-item"><strong>🏆 You\'re at the highest tier!</strong></div>'}
        `;
    } catch (error) {
        showError('stakeResult', error.message);
    }
}

async function calculateMerchantEarnings() {
    const merchantId = document.getElementById('calcMerchantId').value;
    const monthlySales = parseFloat(document.getElementById('calcMonthlySales').value);
    
    if (!monthlySales || monthlySales <= 0) {
        showError('earningsCalcResult', 'Please enter a valid monthly sales amount');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/merchant/calculate-earnings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchantId: merchantId || null, monthlySales })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('earningsCalcResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>💰 Monthly Earnings Calculator</h4>
            
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                <h5>Monthly Sales: $${monthlySales.toLocaleString()}</h5>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;">
                    <h5>💳 With USD Payments</h5>
                    <strong>Transaction Fees:</strong> -$${data.usdFees.toFixed(2)}<br>
                    <strong>Cashback:</strong> $0<br>
                    <strong>Staking Rewards:</strong> $0<br>
                    <hr style="margin: 10px 0;">
                    <strong style="font-size: 1.2rem;">Net Benefit: $0</strong>
                </div>
                
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                    <h5>🚀 With KENO Payments</h5>
                    <strong>Transaction Fees:</strong> -$${data.kenoFees.toFixed(2)}<br>
                    <strong>Cashback:</strong> +$${data.cashbackEarned.toFixed(2)}<br>
                    <strong>Staking Rewards:</strong> +$${data.stakingRewards.toFixed(2)}<br>
                    <hr style="margin: 10px 0;">
                    <strong style="font-size: 1.2rem; color: #2ecc71;">Net Benefit: +$${data.totalMonthlyBenefit.toFixed(2)}</strong>
                </div>
            </div>
            
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(243, 156, 18, 0.1)); border-left: 4px solid #f39c12;">
                <h5>💎 Total Advantage</h5>
                <strong style="font-size: 1.4rem; color: #f39c12;">
                    You earn $${(data.totalMonthlyBenefit + data.usdFees).toFixed(2)} more per month with KENO!
                </strong><br>
                <p style="margin-top: 10px; color: #666;">
                    That's $${((data.totalMonthlyBenefit + data.usdFees) * 12).toFixed(2)} more per year! 🎉
                </p>
            </div>
        `;
    } catch (error) {
        showError('earningsCalcResult', error.message);
    }
}

async function loadMarketData() {
    try {
        const response = await fetch(`${API_BASE}/api/exchange/markets/all`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('marketDataResult');
        let html = '<h4>KENO Market Data</h4>';
        
        for (const [pair, marketData] of Object.entries(data.markets)) {
            const priceClass = marketData.priceChange24h >= 0 ? 'price-up' : 'price-down';
            const priceSymbol = marketData.priceChange24h >= 0 ? '▲' : '▼';
            
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                    <strong style="font-size: 1.2rem;">${pair.replace('_', '/')}</strong><br>
                    <strong>Last Price:</strong> ${marketData.lastPrice.toFixed(8)}<br>
                    <strong>24h Change:</strong> <span class="${priceClass}">${priceSymbol} ${marketData.priceChangePercent24h.toFixed(2)}%</span><br>
                    <strong>24h High:</strong> ${marketData.high24h.toFixed(8)}<br>
                    <strong>24h Low:</strong> ${marketData.low24h.toFixed(8)}<br>
                    <strong>24h Volume:</strong> ${marketData.volume24h.toFixed(2)} KENO
                </div>
            `;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('marketDataResult', error.message);
    }
}

async function loadOrderBook() {
    const pair = document.getElementById('orderBookPair').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/exchange/orderbook/${pair}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('orderBookResult');
        let html = `<h4>Order Book - ${pair.replace('_', '/')}</h4>`;
        
        html += '<div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;"><h5>Bids (Buy Orders)</h5>';
        if (data.bids && data.bids.length > 0) {
            data.bids.slice(0, 10).forEach(bid => {
                html += `<div>Price: ${bid.price.toFixed(8)} | Quantity: ${bid.quantity.toFixed(4)} KENO</div>`;
            });
        } else {
            html += '<p>No buy orders</p>';
        }
        html += '</div>';
        
        html += '<div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;"><h5>Asks (Sell Orders)</h5>';
        if (data.asks && data.asks.length > 0) {
            data.asks.slice(0, 10).forEach(ask => {
                html += `<div>Price: ${ask.price.toFixed(8)} | Quantity: ${ask.quantity.toFixed(4)} KENO</div>`;
            });
        } else {
            html += '<p>No sell orders</p>';
        }
        html += '</div>';
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('orderBookResult', error.message);
    }
}

async function placeOrder() {
    const userAddress = document.getElementById('tradeWalletAddress').value;
    const pair = document.getElementById('tradePair').value;
    const side = document.getElementById('tradeSide').value;
    const orderType = document.getElementById('tradeOrderType').value;
    const quantity = parseFloat(document.getElementById('tradeQuantity').value);
    const price = orderType === 'limit' ? parseFloat(document.getElementById('tradePrice').value) : null;
    const privateKey = document.getElementById('tradePrivateKey').value;
    
    if (!userAddress || !quantity || !privateKey) {
        showError('placeOrderResult', 'Please fill in all required fields');
        return;
    }
    
    if (orderType === 'limit' && !price) {
        showError('placeOrderResult', 'Please enter a limit price');
        return;
    }
    
    try {
        const timestamp = Date.now();
        const orderData = userAddress + pair + side + orderType + quantity + (price || 0) + timestamp;
        const hash = CryptoJS.SHA256(orderData).toString();
        
        const keyPair = ec.keyFromPrivate(privateKey, 'hex');
        const signature = keyPair.sign(hash, 'hex').toDER('hex');
        
        const response = await fetch(`${API_BASE}/api/exchange/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress,
                pair,
                side,
                orderType,
                quantity,
                price,
                signature,
                timestamp
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('placeOrderResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Order Placed Successfully!</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                <strong>Order ID:</strong> ${data.order.orderId}<br>
                <strong>Pair:</strong> ${data.order.pair.replace('_', '/')}<br>
                <strong>Side:</strong> ${data.order.side.toUpperCase()}<br>
                <strong>Type:</strong> ${data.order.orderType}<br>
                <strong>Quantity:</strong> ${data.order.quantity} KENO<br>
                ${data.order.price ? `<strong>Price:</strong> ${data.order.price}<br>` : ''}
                <strong>Status:</strong> ${data.order.status.toUpperCase()}<br>
                <strong>Filled:</strong> ${data.order.filledQuantity} KENO<br>
                <p style="margin-top: 10px; color: #3498db; font-weight: 600;">
                    📊 Your order is ${data.order.status === 'open' ? 'live on the order book' : data.order.status}!
                </p>
            </div>
        `;
    } catch (error) {
        showError('placeOrderResult', error.message);
    }
}

async function loadRecentTrades() {
    const pair = document.getElementById('tradesPair').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/exchange/trades/${pair}?limit=20`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('recentTradesResult');
        
        if (!data.trades || data.trades.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = `<p>No trades yet for ${pair.replace('_', '/')}</p>`;
            return;
        }
        
        let html = `<h4>Recent Trades - ${pair.replace('_', '/')} (${data.count})</h4>`;
        data.trades.forEach(trade => {
            html += `
                <div class="transaction-item">
                    <strong>Price:</strong> ${trade.price.toFixed(8)}<br>
                    <strong>Quantity:</strong> ${trade.quantity.toFixed(4)} KENO<br>
                    <strong>Total:</strong> ${trade.total.toFixed(8)}<br>
                    <strong>Time:</strong> ${new Date(trade.timestamp).toLocaleTimeString()}<br>
                    <strong>Trade ID:</strong> ${trade.tradeId}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('recentTradesResult', error.message);
    }
}

async function loadUserOrders() {
    const userAddress = document.getElementById('userOrdersAddress').value;
    if (!userAddress) {
        showError('userOrdersResult', 'Please enter your wallet address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/exchange/orders/${userAddress}?status=open`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('userOrdersResult');
        
        if (!data.orders || data.orders.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No open orders found</p>';
            return;
        }
        
        let html = `<h4>Your Open Orders (${data.count})</h4>`;
        data.orders.forEach(order => {
            html += `
                <div class="transaction-item">
                    <strong>Order ID:</strong> ${order.orderId}<br>
                    <strong>Pair:</strong> ${order.pair.replace('_', '/')}<br>
                    <strong>Side:</strong> ${order.side.toUpperCase()}<br>
                    <strong>Price:</strong> ${order.price?.toFixed(8) || 'Market'}<br>
                    <strong>Quantity:</strong> ${order.quantity} KENO<br>
                    <strong>Filled:</strong> ${order.filledQuantity} KENO<br>
                    <strong>Remaining:</strong> ${order.remainingQuantity} KENO<br>
                    <strong>Status:</strong> ${order.status.toUpperCase()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('userOrdersResult', error.message);
    }
}

async function viewTradingPairs() {
    try {
        const response = await fetch(`${API_BASE}/api/exchange/pairs`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('tradingPairsResult');
        let html = '<h4>Available Trading Pairs</h4>';
        
        data.pairs.forEach(pair => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                    <strong style="font-size: 1.1rem;">${pair.baseAsset}/${pair.quoteAsset}</strong><br>
                    <strong>Min Order Size:</strong> ${pair.minOrderSize}<br>
                    <strong>Max Order Size:</strong> ${pair.maxOrderSize.toLocaleString()}<br>
                    <strong>Trading Fee:</strong> ${(pair.tradingFee * 100).toFixed(2)}%<br>
                    <strong>Status:</strong> ${pair.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('tradingPairsResult', error.message);
    }
}

function togglePriceField() {
    const orderType = document.getElementById('tradeOrderType').value;
    const priceField = document.getElementById('tradePriceField');
    priceField.style.display = orderType === 'limit' ? 'block' : 'none';
}

function selectTradeSide(side) {
    document.getElementById('tradeSide').value = side;
    
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    const display = document.getElementById('tradeSideDisplay');
    
    if (side === 'buy') {
        buyBtn.style.opacity = '1';
        buyBtn.style.transform = 'scale(1.05)';
        sellBtn.style.opacity = '0.5';
        sellBtn.style.transform = 'scale(1)';
        display.style.background = 'rgba(46, 204, 113, 0.1)';
        display.style.color = 'var(--accent-green)';
        display.innerHTML = '✅ Selected: BUY KENO';
    } else {
        sellBtn.style.opacity = '1';
        sellBtn.style.transform = 'scale(1.05)';
        buyBtn.style.opacity = '0.5';
        buyBtn.style.transform = 'scale(1)';
        display.style.background = 'rgba(231, 76, 60, 0.1)';
        display.style.color = '#e74c3c';
        display.innerHTML = '✅ Selected: SELL KENO';
    }
}

async function registerBankingAccount() {
    try {
        const walletAddress = document.getElementById('bankingWalletAddress').value;
        const email = document.getElementById('bankingEmail').value;
        const fullName = document.getElementById('bankingFullName').value;

        if (!walletAddress || !email || !fullName) {
            alert('Please fill in all fields');
            return;
        }

        const response = await fetch(`${API_BASE}/api/banking/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, email, fullName })
        });

        const data = await response.json();
        
        if (data.success) {
            const resultDiv = document.getElementById('registerBankingResult');
            resultDiv.className = 'result success';
            resultDiv.innerHTML = `
                <h4>✅ Banking Account Registered!</h4>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                    <strong>Wallet:</strong> ${data.account.walletAddress}<br>
                    <strong>Email:</strong> ${data.account.email}<br>
                    <strong>Name:</strong> ${data.account.fullName}<br>
                    <strong>Registered:</strong> ${new Date(data.account.registeredAt).toLocaleString()}
                </div>
            `;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError('registerBankingResult', error.message);
    }
}

async function depositStripe() {
    try {
        const walletAddress = document.getElementById('stripeDepositWallet').value;
        const amount = parseFloat(document.getElementById('stripeDepositAmount').value);

        if (!walletAddress || !amount || amount < 10) {
            alert('Please enter wallet address and amount ($10 minimum)');
            return;
        }

        const response = await fetch(`${API_BASE}/api/banking/deposit/stripe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, amount })
        });

        const data = await response.json();
        
        if (data.success) {
            const confirmResponse = await fetch(`${API_BASE}/api/banking/deposit/stripe/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    depositId: data.deposit.depositId,
                    paymentIntentId: data.paymentIntentId
                })
            });

            const confirmData = await confirmResponse.json();

            if (confirmData.success) {
                const resultDiv = document.getElementById('stripeDepositResult');
                resultDiv.className = 'result success';
                resultDiv.innerHTML = `
                    <h4>✅ Deposit Completed!</h4>
                    <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                        <strong>Deposit ID:</strong> ${confirmData.deposit.depositId}<br>
                        <strong>Amount:</strong> $${confirmData.deposit.amount.toFixed(2)}<br>
                        <strong>Fee:</strong> $${confirmData.deposit.fee.toFixed(2)}<br>
                        <strong>Net Amount:</strong> $${confirmData.deposit.netAmount.toFixed(2)}<br>
                        <strong>New Balance:</strong> $${confirmData.newBalance.toFixed(2)}<br>
                        <strong>Status:</strong> ${confirmData.deposit.status.toUpperCase()}<br>
                        ${data.paymentIntentId.includes('test') ? '<br><strong>⚠️ TEST MODE:</strong> No real payment processed' : ''}
                    </div>
                `;
            } else {
                throw new Error(confirmData.error);
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError('stripeDepositResult', error.message);
    }
}

async function depositPayPal() {
    try {
        const walletAddress = document.getElementById('paypalDepositWallet').value;
        const amount = parseFloat(document.getElementById('paypalDepositAmount').value);

        if (!walletAddress || !amount || amount < 10) {
            alert('Please enter wallet address and amount ($10 minimum)');
            return;
        }

        const response = await fetch(`${API_BASE}/api/banking/deposit/paypal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, amount })
        });

        const data = await response.json();
        
        if (data.success) {
            const confirmResponse = await fetch(`${API_BASE}/api/banking/deposit/paypal/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    depositId: data.deposit.depositId,
                    orderId: data.orderId
                })
            });

            const confirmData = await confirmResponse.json();

            if (confirmData.success) {
                const resultDiv = document.getElementById('paypalDepositResult');
                resultDiv.className = 'result success';
                resultDiv.innerHTML = `
                    <h4>✅ PayPal Deposit Completed!</h4>
                    <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                        <strong>Deposit ID:</strong> ${confirmData.deposit.depositId}<br>
                        <strong>Amount:</strong> $${confirmData.deposit.amount.toFixed(2)}<br>
                        <strong>Fee:</strong> $${confirmData.deposit.fee.toFixed(2)}<br>
                        <strong>Net Amount:</strong> $${confirmData.deposit.netAmount.toFixed(2)}<br>
                        <strong>New Balance:</strong> $${confirmData.newBalance.toFixed(2)}<br>
                        <strong>Status:</strong> ${confirmData.deposit.status.toUpperCase()}<br>
                        ${data.orderId.includes('PAYPAL') ? '<br><strong>⚠️ TEST MODE:</strong> No real payment processed' : ''}
                    </div>
                `;
            } else {
                throw new Error(confirmData.error);
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError('paypalDepositResult', error.message);
    }
}

async function withdrawStripe() {
    try {
        const walletAddress = document.getElementById('stripeWithdrawWallet').value;
        const amount = parseFloat(document.getElementById('stripeWithdrawAmount').value);

        if (!walletAddress || !amount) {
            alert('Please fill in all fields');
            return;
        }

        if (amount < 10) {
            alert('Minimum withdrawal is $10');
            return;
        }

        const resultDiv = document.getElementById('stripeWithdrawResult');
        resultDiv.className = 'result';
        resultDiv.innerHTML = '<p>Processing withdrawal...</p>';

        const response = await fetch(`${API_BASE}/api/banking/withdrawal/stripe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress,
                amount
            })
        });

        const data = await response.json();
        
        if (data.success) {
            resultDiv.className = 'result success';
            resultDiv.innerHTML = `
                <h4>✅ Withdrawal Completed!</h4>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(230, 126, 34, 0.1), rgba(211, 84, 0, 0.1)); border-left: 4px solid #e67e22;">
                    <strong>Withdrawal ID:</strong> ${data.withdrawal.withdrawalId}<br>
                    <strong>Amount:</strong> $${data.withdrawal.amount.toFixed(2)}<br>
                    <strong>Fee:</strong> $${data.withdrawal.fee.toFixed(2)}<br>
                    <strong>Total Deducted:</strong> $${data.withdrawal.totalAmount.toFixed(2)}<br>
                    <strong>Payout ID:</strong> ${data.payoutId}<br>
                    <strong>Status:</strong> ${data.withdrawal.status.toUpperCase()}<br>
                    <strong>Destination:</strong> Your Stripe-connected bank account<br>
                    ${data.payoutId && data.payoutId.includes('test') ? '<br><strong>⚠️ TEST MODE:</strong> No real payout processed' : '<br><strong>💰 LIVE MODE:</strong> Real money sent to your bank!'}
                </div>
            `;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError('stripeWithdrawResult', error.message);
    }
}

async function withdrawPayPal() {
    try {
        const walletAddress = document.getElementById('paypalWithdrawWallet').value;
        const amount = parseFloat(document.getElementById('paypalWithdrawAmount').value);
        const paypalEmail = document.getElementById('paypalWithdrawEmail').value;

        if (!walletAddress || !amount || !paypalEmail) {
            alert('Please fill in all fields');
            return;
        }

        if (amount < 10) {
            alert('Minimum withdrawal is $10');
            return;
        }

        const resultDiv = document.getElementById('paypalWithdrawResult');
        resultDiv.className = 'result';
        resultDiv.innerHTML = '<p>Processing PayPal withdrawal...</p>';

        const response = await fetch(`${API_BASE}/api/banking/withdrawal/paypal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, amount, paypalEmail })
        });

        const data = await response.json();
        
        if (data.success) {
            resultDiv.className = 'result success';
            resultDiv.innerHTML = `
                <h4>✅ PayPal Withdrawal Completed!</h4>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                    <strong>Withdrawal ID:</strong> ${data.withdrawal.withdrawalId}<br>
                    <strong>Amount:</strong> $${data.withdrawal.amount.toFixed(2)}<br>
                    <strong>Fee:</strong> $${data.withdrawal.fee.toFixed(2)}<br>
                    <strong>Total Deducted:</strong> $${data.withdrawal.totalAmount.toFixed(2)}<br>
                    <strong>Batch ID:</strong> ${data.batchId}<br>
                    <strong>Status:</strong> ${data.withdrawal.status.toUpperCase()}<br>
                    <strong>PayPal Email:</strong> ${paypalEmail}<br>
                    ${data.batchId.includes('BATCH') ? '<br><strong>⚠️ TEST MODE:</strong> No real payout processed' : ''}
                </div>
            `;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError('paypalWithdrawResult', error.message);
    }
}

async function checkFiatBalance() {
    try {
        const walletAddress = document.getElementById('checkFiatBalanceWallet').value;

        if (!walletAddress) {
            alert('Please enter wallet address');
            return;
        }

        const response = await fetch(`${API_BASE}/api/banking/balance/${walletAddress}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('fiatBalanceResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>💵 USD Balance</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                <strong>Wallet:</strong> ${data.walletAddress}<br>
                <strong>Balance:</strong> <span style="font-size: 1.5rem; color: #2ecc71;">$${data.balance.toFixed(2)}</span>
            </div>
        `;
    } catch (error) {
        showError('fiatBalanceResult', error.message);
    }
}

async function viewBankingHistory() {
    try {
        const walletAddress = document.getElementById('bankingHistoryWallet').value;

        if (!walletAddress) {
            alert('Please enter wallet address');
            return;
        }

        const [depositsRes, withdrawalsRes, transactionsRes] = await Promise.all([
            fetch(`${API_BASE}/api/banking/deposits/${walletAddress}`),
            fetch(`${API_BASE}/api/banking/withdrawals/${walletAddress}`),
            fetch(`${API_BASE}/api/banking/transactions/${walletAddress}`)
        ]);

        const [depositsData, withdrawalsData, transactionsData] = await Promise.all([
            depositsRes.json(),
            withdrawalsRes.json(),
            transactionsRes.json()
        ]);

        const resultDiv = document.getElementById('bankingHistoryResult');
        let html = '<h4>💳 Banking History</h4>';

        if (depositsData.deposits && depositsData.deposits.length > 0) {
            html += '<h5>Recent Deposits</h5>';
            depositsData.deposits.slice(0, 5).forEach(dep => {
                html += `
                    <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                        <strong>ID:</strong> ${dep.depositId}<br>
                        <strong>Amount:</strong> $${dep.amount.toFixed(2)}<br>
                        <strong>Net:</strong> $${dep.netAmount.toFixed(2)}<br>
                        <strong>Method:</strong> ${dep.method.toUpperCase()}<br>
                        <strong>Status:</strong> ${dep.status.toUpperCase()}<br>
                        <strong>Date:</strong> ${new Date(dep.createdAt).toLocaleString()}
                    </div>
                `;
            });
        }

        if (withdrawalsData.withdrawals && withdrawalsData.withdrawals.length > 0) {
            html += '<h5>Recent Withdrawals</h5>';
            withdrawalsData.withdrawals.slice(0, 5).forEach(wd => {
                html += `
                    <div class="transaction-item" style="background: linear-gradient(135deg, rgba(230, 126, 34, 0.1), rgba(211, 84, 0, 0.1)); border-left: 4px solid #e67e22;">
                        <strong>ID:</strong> ${wd.withdrawalId}<br>
                        <strong>Amount:</strong> $${wd.amount.toFixed(2)}<br>
                        <strong>Total:</strong> $${wd.totalAmount.toFixed(2)}<br>
                        <strong>Method:</strong> ${wd.method.toUpperCase()}<br>
                        <strong>Status:</strong> ${wd.status.toUpperCase()}<br>
                        <strong>Date:</strong> ${new Date(wd.createdAt).toLocaleString()}
                    </div>
                `;
            });
        }

        if ((!depositsData.deposits || depositsData.deposits.length === 0) &&
            (!withdrawalsData.withdrawals || withdrawalsData.withdrawals.length === 0)) {
            html += '<p>No banking history found</p>';
        }

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('bankingHistoryResult', error.message);
    }
}

async function viewBankingStats() {
    try {
        const response = await fetch(`${API_BASE}/api/banking/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('bankingStatsResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>📊 Banking Statistics</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                <strong>Total Accounts:</strong> ${data.totalAccounts}<br>
                <strong>Total Deposits:</strong> $${data.totalDeposits.toFixed(2)}<br>
                <strong>Completed Deposits:</strong> ${data.completedDeposits}<br>
                <strong>Total Withdrawals:</strong> $${data.totalWithdrawals.toFixed(2)}<br>
                <strong>Completed Withdrawals:</strong> ${data.completedWithdrawals}<br>
                <strong>Net Flow:</strong> <span style="color: ${data.netFlow >= 0 ? '#2ecc71' : '#e74c3c'};">$${data.netFlow.toFixed(2)}</span>
            </div>
        `;
    } catch (error) {
        showError('bankingStatsResult', error.message);
    }
}

// ==================== REVENUE DASHBOARD FUNCTIONS ====================

async function loadGlobalRevenue() {
    try {
        const response = await fetch(`${API_BASE}/api/revenue/report/global`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('globalRevenueData');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>💰 Total Platform Revenue</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.15), rgba(142, 68, 173, 0.15)); border-left: 4px solid #9b59b6; padding: 20px;">
                <div style="font-size: 2rem; font-weight: 700; color: #9b59b6; margin-bottom: 15px;">$${data.summary.totalRevenue}</div>
                <strong style="font-size: 1.1rem;">Revenue Streams:</strong><br>
                <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                    <strong>💳 Merchant Gateway:</strong> $${data.summary.merchantGatewayRevenue} (2.5% fee)<br>
                    <strong>📈 Exchange Trading:</strong> $${data.summary.tradingRevenue} (0.5% fee)<br>
                    <strong>🏢 White-Label Licensing:</strong> $${data.summary.licensingRevenue}<br>
                </div>
                <strong style="font-size: 1.1rem; color: #2ecc71;">💵 Monthly Recurring Revenue:</strong> $${data.summary.monthlyRecurringRevenue}<br>
                <strong style="color: var(--text-muted);">📊 Projected Annual Revenue:</strong> $${data.projections.projectedAnnualRevenue}
            </div>
            
            <h4 style="margin-top: 20px;">📊 Revenue Statistics</h4>
            <div class="transaction-item">
                <strong>Merchant Gateway:</strong><br>
                &nbsp;&nbsp;• Total Merchants: ${data.merchants.total}<br>
                &nbsp;&nbsp;• Total Transactions: ${data.merchants.totalTransactions}<br>
                &nbsp;&nbsp;• Avg Fee/Transaction: $${data.merchants.averageFeePerTransaction}<br><br>
                
                <strong>Exchange Trading:</strong><br>
                &nbsp;&nbsp;• Total Traders: ${data.exchange.totalTraders}<br>
                &nbsp;&nbsp;• Total Trades: ${data.exchange.totalTrades}<br>
                &nbsp;&nbsp;• Avg Fee/Trade: $${data.exchange.averageFeePerTrade}<br><br>
                
                <strong>White-Label Licensing:</strong><br>
                &nbsp;&nbsp;• Total Licenses: ${data.licensing.totalLicenses}<br>
                &nbsp;&nbsp;• Active Licenses: ${data.licensing.activeLicenses}<br>
                &nbsp;&nbsp;• Basic Tier: ${data.licensing.basicLicenses}<br>
                &nbsp;&nbsp;• Professional Tier: ${data.licensing.professionalLicenses}<br>
                &nbsp;&nbsp;• Enterprise Tier: ${data.licensing.enterpriseLicenses}
            </div>
        `;
    } catch (error) {
        showError('globalRevenueData', error.message);
    }
}

async function loadRevenueBreakdown() {
    try {
        const response = await fetch(`${API_BASE}/api/revenue/report/breakdown`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('revenueBreakdown');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>📊 Revenue Breakdown</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                    <strong>💳 Merchant Gateway</strong><br>
                    Revenue: $${data.merchantGateway.revenue}<br>
                    Percentage: ${data.merchantGateway.percentage}<br>
                    Fee Rate: ${data.merchantGateway.feeRate}
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                    <strong>📈 Exchange Trading</strong><br>
                    Revenue: $${data.exchangeTrading.revenue}<br>
                    Percentage: ${data.exchangeTrading.percentage}<br>
                    Fee Rate: ${data.exchangeTrading.feeRate}
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                    <strong>🏢 White-Label Licensing</strong><br>
                    Revenue: $${data.whiteLabelLicensing.revenue}<br>
                    Percentage: ${data.whiteLabelLicensing.percentage}<br>
                    Tiers: ${data.whiteLabelLicensing.tiers}
                </div>
            </div>
            <div class="transaction-item" style="margin-top: 15px; text-align: center; background: linear-gradient(135deg, rgba(230, 126, 34, 0.1), rgba(211, 84, 0, 0.1)); border-left: 4px solid #e67e22;">
                <strong style="font-size: 1.3rem;">Total Platform Revenue: $${data.total}</strong>
            </div>
        `;
    } catch (error) {
        showError('revenueBreakdown', error.message);
    }
}

async function loadMerchantRevenue() {
    try {
        const merchantId = document.getElementById('merchantRevenueId').value;
        if (!merchantId) {
            alert('Please enter a merchant ID');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/revenue/merchant/${merchantId}/report`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('merchantRevenueData');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>💳 Merchant Revenue Report: ${data.merchantId}</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                <strong>Total Transactions:</strong> ${data.totalTransactions}<br>
                <strong>Total Gross:</strong> $${data.totalGross}<br>
                <strong>Platform Fees Collected:</strong> $${data.totalFees} (${data.feePercentage})<br>
                <strong>Net to Merchant:</strong> $${data.totalNet}
            </div>
            <h5 style="margin-top: 15px;">Recent Transactions (Last 50)</h5>
            ${data.transactions.slice(0, 10).map(tx => `
                <div class="transaction-item">
                    <strong>ID:</strong> ${tx.transactionId}<br>
                    <strong>Gross:</strong> $${tx.grossAmount.toFixed(2)} → 
                    <strong>Fee:</strong> $${tx.platformFee.toFixed(2)} → 
                    <strong>Net:</strong> $${tx.netAmount.toFixed(2)}<br>
                    <strong>Date:</strong> ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `).join('')}
        `;
    } catch (error) {
        showError('merchantRevenueData', error.message);
    }
}

async function loadTradingFees() {
    try {
        const address = document.getElementById('tradingFeesAddress').value;
        if (!address) {
            alert('Please enter a user address');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/revenue/exchange/${address}/fees`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('tradingFeesData');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>📈 Trading Fees Report</h4>
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.1)); border-left: 4px solid #3498db;">
                <strong>User:</strong> ${data.userAddress.substring(0, 20)}...<br>
                <strong>Total Trades:</strong> ${data.totalTrades}<br>
                <strong>Total Volume:</strong> $${data.totalVolume}<br>
                <strong>Total Fees Paid:</strong> $${data.totalFees} (${data.feePercentage})
            </div>
            <h5 style="margin-top: 15px;">Recent Trades (Last 50)</h5>
            ${data.trades.slice(0, 10).map(trade => `
                <div class="transaction-item">
                    <strong>${trade.side.toUpperCase()}:</strong> ${trade.quantity} @ $${trade.price}<br>
                    <strong>Pair:</strong> ${trade.pair} | <strong>Value:</strong> $${trade.tradeValue.toFixed(2)}<br>
                    <strong>Fee:</strong> $${trade.tradingFee.toFixed(2)}<br>
                    <strong>Date:</strong> ${new Date(trade.timestamp).toLocaleString()}
                </div>
            `).join('')}
        `;
    } catch (error) {
        showError('tradingFeesData', error.message);
    }
}

async function loadLicensePricing() {
    try {
        const response = await fetch(`${API_BASE}/api/revenue/license/pricing`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('licensePricingData');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>🏢 White-Label Licensing Tiers</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.2)); border-left: 4px solid silver;">
                    <h5 style="color: silver; margin: 0 0 10px 0;">BASIC</h5>
                    <div style="font-size: 1.8rem; font-weight: 700; color: silver; margin-bottom: 10px;">$${data.BASIC.price}/mo</div>
                    <strong>Features:</strong><br>
                    ${data.BASIC.features.map(f => `• ${f}<br>`).join('')}
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.2)); border-left: 4px solid #3498db;">
                    <h5 style="color: #3498db; margin: 0 0 10px 0;">PROFESSIONAL</h5>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #3498db; margin-bottom: 10px;">$${data.PROFESSIONAL.price}/mo</div>
                    <strong>Features:</strong><br>
                    ${data.PROFESSIONAL.features.map(f => `• ${f}<br>`).join('')}
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.2), rgba(142, 68, 173, 0.2)); border-left: 4px solid #9b59b6;">
                    <h5 style="color: #9b59b6; margin: 0 0 10px 0;">ENTERPRISE</h5>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #9b59b6; margin-bottom: 10px;">$${data.ENTERPRISE.price}/mo</div>
                    <strong>Features:</strong><br>
                    ${data.ENTERPRISE.features.map(f => `• ${f}<br>`).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        showError('licensePricingData', error.message);
    }
}

async function loadAllLicenses() {
    try {
        const response = await fetch(`${API_BASE}/api/revenue/licenses/all`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allLicensesData');
        
        if (!data || data.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No licenses created yet</p>';
            return;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>🏢 All White-Label Licenses (${data.length})</h4>
            ${data.map(license => `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                    <strong>Organization:</strong> ${license.organizationName}<br>
                    <strong>License ID:</strong> ${license.licenseId}<br>
                    <strong>Tier:</strong> <span style="color: #9b59b6; font-weight: 700;">${license.tier}</span><br>
                    <strong>Monthly Price:</strong> $${license.monthlyPrice}/mo<br>
                    <strong>Total Revenue:</strong> $${license.totalRevenue}<br>
                    <strong>Status:</strong> <span style="color: ${license.status === 'active' ? '#2ecc71' : '#e74c3c'};">${license.status.toUpperCase()}</span><br>
                    <strong>Created:</strong> ${license.createdAt}
                </div>
            `).join('')}
        `;
    } catch (error) {
        showError('allLicensesData', error.message);
    }
}

async function purchaseLicense() {
    try {
        const organizationName = document.getElementById('licensePurchaseOrgName').value;
        const contactEmail = document.getElementById('licensePurchaseEmail').value;
        const customDomain = document.getElementById('licensePurchaseDomain').value;
        const tier = document.getElementById('licensePurchaseTier').value;
        
        if (!organizationName || !contactEmail || !tier) {
            alert('Please fill in organization name, contact email, and select a tier');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            alert('Please enter a valid email address');
            return;
        }
        
        const resultDiv = document.getElementById('licensePurchaseResult');
        resultDiv.className = 'result';
        resultDiv.innerHTML = '<p>Creating Stripe checkout session...</p>';
        
        const response = await fetch(`${API_BASE}/api/revenue/license/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organizationName,
                tier,
                contactEmail,
                customDomain: customDomain || undefined
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.checkoutUrl) {
            resultDiv.className = 'result success';
            resultDiv.innerHTML = `
                <h4>✅ Checkout Session Created!</h4>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(142, 68, 173, 0.1)); border-left: 4px solid #9b59b6;">
                    <strong>Organization:</strong> ${organizationName}<br>
                    <strong>Tier:</strong> ${tier}<br>
                    <strong>Monthly Price:</strong> $${data.monthlyPrice}/month<br>
                    <strong>Contact Email:</strong> ${contactEmail}<br><br>
                    <p style="margin-top: 10px;">Redirecting to Stripe checkout...</p>
                </div>
            `;
            
            // Redirect to Stripe checkout
            setTimeout(() => {
                window.location.href = data.checkoutUrl;
            }, 2000);
        } else {
            throw new Error(data.error || 'Failed to create checkout session');
        }
    } catch (error) {
        showError('licensePurchaseResult', error.message);
    }
}
