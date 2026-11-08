/**
 * AETHERBUILDER - PRE-BUILT DEMO TEMPLATES
 * Complete landing page configurations ready to be loaded with a single click.
 */

export const TEMPLATES = {
  saas: {
    id: 'saas',
    name: 'SaaS Launchpad Pro',
    category: 'Startup & Tech',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
    description: 'Complete high-converting SaaS landing page with animated stats, feature carousel, and pricing.',
    sections: [
      {
        id: 'sec_nav',
        widgetType: 'navbar',
        props: {
          brandText: 'AetherStudio',
          brandIcon: '⚡',
          floating: true,
          sticky: true,
          logoType: 'icon',
          logoImageUrl: '',
          logoLink: '#',
          logoWidth: 38,
          showBrandText: true,
          ctaText: 'Get Started',
          ctaLink: '#pricing',
          links: [
            { label: 'Features', url: '#features' },
            { label: 'Metrics', url: '#stats' },
            { label: 'Gallery', url: '#gallery' },
            { label: 'Showcase', url: '#slider' },
            { label: 'Pricing', url: '#pricing' },
            { label: 'FAQ', url: '#faq' }
          ]
        }
      },
      {
        id: 'sec_hero',
        widgetType: 'hero',
        props: {
          badgeText: '🚀 Next-Gen Visual Web Engine',
          title: 'Craft Extraordinary Digital Experiences with Ease',
          highlightWord: 'Extraordinary',
          description: 'The ultra-responsive, Elementor-grade web builder with cryptographic Argon2 protection, live reactive components, and instant publishing.',
          primaryBtnText: 'Start Building Free',
          primaryBtnLink: '#features',
          secondaryBtnText: 'Explore Showcase',
          secondaryBtnLink: '#slider'
        }
      },
      {
        id: 'sec_divider_1',
        widgetType: 'divider',
        props: {
          style: 'glow',
          badgeText: 'CAPABILITIES'
        }
      },
      {
        id: 'sec_counters',
        widgetType: 'counter',
        props: {
          badge: 'PROVEN TRACTION',
          title: 'Battle-Tested Global Scale',
          subtitle: 'Real-time metrics demonstrating rock-solid infrastructure and worldwide creator trust.',
          stats: [
            { icon: '⚡', target: 99.9, prefix: '', suffix: '%', label: 'Uptime SLA', decimals: 1 },
            { icon: '👥', target: 140, prefix: '', suffix: 'K+', label: 'Active Creators', decimals: 0 },
            { icon: '🌍', target: 82, prefix: '', suffix: '+', label: 'Global PoPs', decimals: 0 },
            { icon: '⭐', target: 4.95, prefix: '', suffix: '/5', label: 'Customer CSAT', decimals: 2 }
          ]
        }
      },
      {
        id: 'sec_divider_features',
        widgetType: 'divider',
        props: {
          style: 'glow',
          badgeText: 'CORE PILLARS'
        }
      },
      {
        id: 'sec_features',
        widgetType: 'features_grid',
        props: {
          badge: 'ENGINE ARCHITECTURE',
          title: 'Built for High-Velocity Web Creation',
          subtitle: 'Combine fluid visual freedom with cryptographic defense and sub-millisecond responsiveness.',
          cards: [
            {
              icon: '⚡',
              title: 'Sub-millisecond Canvas',
              desc: 'Every edit, color shift, and layout tweak updates the live virtual tree instantly with zero stutter or lag.'
            },
            {
              icon: '🔐',
              title: 'Argon2id Wasm Defense',
              desc: 'Cryptographically shielded admin portal backed by memory-hard WebAssembly Argon2 password verification.'
            },
            {
              icon: '📱',
              title: 'Pixel-Accurate Device Views',
              desc: 'Simulate Desktop, Tablet (768px), and Mobile (390px) viewports with realistic chassis previewing.'
            }
          ]
        }
      },
      {
        id: 'sec_button_cta',
        widgetType: 'button',
        props: {
          text: 'Launch AetherBuilder Studio',
          link: '?view=admin',
          targetBlank: false,
          btnStyle: 'glow',
          size: 'large',
          alignment: 'center',
          icon: '⚡',
          iconPosition: 'right',
          subtext: 'Argon2id Encrypted • Zero Software Installation Needed'
        }
      },
      {
        id: 'sec_slider',
        widgetType: 'slider',
        props: {
          autoPlay: true,
          autoPlayInterval: 4000,
          showSlideButtons: true,
          slides: [
            {
              bgImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
              title: 'Quantum Cloud Infrastructure',
              desc: 'High-concurrency edge clusters designed to withstand massive traffic spikes without latency.',
              showButton: true,
              btnText: 'Explore Cloud Architecture',
              btnLink: '#features',
              btnStyle: 'primary',
              btnTargetBlank: false
            },
            {
              bgImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
              title: 'Cryptographic Argon2 Suite',
              desc: 'State-of-the-art password verification preventing credential stuffing and brute-force attacks.',
              showButton: true,
              btnText: 'Argon2 Security Audit',
              btnLink: '#stats',
              btnStyle: 'glow',
              btnTargetBlank: false
            },
            {
              bgImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
              title: 'Instant Production Export',
              desc: 'Generate standalone static packages with 100% clean HTML/CSS with one click.',
              showButton: true,
              btnText: 'Explore Pricing Plans',
              btnLink: '#pricing',
              btnStyle: 'primary',
              btnTargetBlank: false
            }
          ]
        }
      },
      {
        id: 'sec_text_image',
        widgetType: 'text_image',
        props: {
          badge: 'Unmatched Simplicity',
          title: 'Drag, Drop, and Publish Without Code Limits',
          body: 'Eliminate tedious back-and-forth between design mockups and codebases. Build, tweak, test animations, and publish directly to visitors.',
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
          imagePosition: 'right',
          features: [
            'WYSIWYG live editing with double-click inline text modification',
            'Full component inspector with Content, Style, and Advanced tabs',
            'Responsive device viewports with fluid mobile breakpoints',
            'Integrated filterable gallery with full-screen lightbox modal'
          ],
          btnText: 'Start Building Free',
          btnLink: '#pricing'
        }
      },
      {
        id: 'sec_gallery',
        widgetType: 'gallery',
        props: {
          filterAllLabel: 'All Masterpieces',
          images: [
            {
              url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
              title: 'Aura Neon Flow',
              category: 'Abstract',
              tag: 'Vibrant'
            },
            {
              url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
              title: 'Microchip Matrix',
              category: 'Technology',
              tag: 'Hardware'
            },
            {
              url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
              title: 'Prismatic Geometry',
              category: 'Abstract',
              tag: '3D Art'
            },
            {
              url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80',
              title: 'Creator Studio Desk',
              category: 'Workspace',
              tag: 'Design'
            },
            {
              url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
              title: 'Cryptographic Security',
              category: 'Technology',
              tag: 'Argon2'
            },
            {
              url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
              title: 'Mobile App Wireframe',
              category: 'Workspace',
              tag: 'Mobile'
            }
          ]
        }
      },
      {
        id: 'sec_divider_2',
        widgetType: 'divider',
        props: {
          style: 'wave'
        }
      },
      {
        id: 'sec_pricing',
        widgetType: 'pricing',
        props: {
          tiers: [
            {
              name: 'Community',
              price: '$0',
              period: '/ forever',
              featured: false,
              features: ['1 Live Published Project', 'Standard Argon2 Hashing', 'Core Widgets Suite', 'Community Support'],
              btnText: 'Start Free'
            },
            {
              name: 'Studio Creator',
              price: '$29',
              period: '/ month',
              featured: true,
              badge: 'Popular',
              features: ['Unlimited Projects', 'Argon2id Wasm Cryptography', 'Full Lightbox & Carousel', '1-Click JSON/HTML Export', 'Global Edge Delivery'],
              btnText: 'Claim 14-Day Trial'
            },
            {
              name: 'Enterprise Matrix',
              price: '$99',
              period: '/ month',
              featured: false,
              features: ['Custom Argon2 Parameters', 'Multi-tenant Permissions', 'Dedicated Uptime SLA', 'White-Label Branding'],
              btnText: 'Contact Enterprise'
            }
          ]
        }
      },
      {
        id: 'sec_faq',
        widgetType: 'faq',
        props: {
          items: [
            {
              question: 'How does the Argon2 password hashing protect my builder?',
              answer: 'Argon2 is the winner of the Password Hashing Competition (PHC). It uses memory-hard functions that resist GPU and ASIC cracking attacks. When you log in, hash-wasm runs the cryptographic verification via WebAssembly right inside your browser!'
            },
            {
              question: 'Can I export the website to host on any server?',
              answer: 'Yes! AetherBuilder provides 1-click HTML & JSON export. You can download the static files and host them on Cloudflare Pages, Netlify, Vercel, AWS S3, or any standard Apache/Nginx web server.'
            },
            {
              question: 'Does the public view load quickly for visitors?',
              answer: 'Absolutely. The public view is stripped of all editor overhead. It renders lightweight, semantic HTML with CSS variables and lazy-loaded media for blazing 99+ Google Lighthouse scores.'
            }
          ]
        }
      },
      {
        id: 'sec_contact',
        widgetType: 'contact',
        props: {
          title: 'Ready to Transform Your Web Building Experience?',
          subtitle: 'Join thousands of creators using AetherBuilder to design, preview, and deploy breathtaking web pages.',
          btnText: 'Send Inquiry'
        }
      },
      {
        id: 'sec_footer',
        widgetType: 'footer',
        props: {
          brandText: 'AetherStudio',
          brandDesc: 'The next-generation visual web engine empowering designers and developers to build at lightspeed.',
          copyright: '© 2026 AetherBuilder Studio Inc. Protected by Argon2id Cryptography.'
        }
      }
    ]
  },

  portfolio: {
    id: 'portfolio',
    name: 'Creative Studio & Portfolio',
    category: 'Portfolio',
    thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
    description: 'Sleek dark portfolio featuring visual gallery, interactive lightbox, and animated credentials.',
    sections: [
      {
        id: 'p_nav',
        widgetType: 'navbar',
        props: {
          brandText: 'Studio Lumen',
          brandIcon: '💎',
          sticky: true,
          ctaText: 'Hire Studio',
          ctaLink: '#contact',
          links: [
            { label: 'Works', url: '#gallery' },
            { label: 'Milestones', url: '#stats' },
            { label: 'Stories', url: '#slider' },
            { label: 'Connect', url: '#contact' }
          ]
        }
      },
      {
        id: 'p_hero',
        widgetType: 'hero',
        props: {
          badgeText: '✦ Design & Engineering Agency',
          title: 'We Shape Brands That Command Undivided Attention',
          highlightWord: 'Command',
          description: 'A boutique visual studio crafting bespoke digital artifacts, interactive identities, and award-winning websites.',
          primaryBtnText: 'View Portfolio',
          primaryBtnLink: '#gallery',
          secondaryBtnText: 'Get in Touch',
          secondaryBtnLink: '#contact'
        }
      },
      {
        id: 'p_divider',
        widgetType: 'divider',
        props: { style: 'glow', badgeText: 'PORTFOLIO' }
      },
      {
        id: 'p_gallery',
        widgetType: 'gallery',
        props: {
          filterAllLabel: 'All Projects',
          images: [
            { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80', title: 'Chromatica Identity', category: 'Branding', tag: 'Visual' },
            { url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80', title: 'Cybernetics UI', category: 'Product', tag: 'Interface' },
            { url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80', title: 'Synesthesia Motion', category: '3D Art', tag: 'Motion' },
            { url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80', title: 'Nordic Architecture', category: 'Branding', tag: 'Space' }
          ]
        }
      },
      {
        id: 'p_counters',
        widgetType: 'counter',
        props: {
          stats: [
            { icon: '🏆', target: 38, prefix: '', suffix: '+', label: 'Design Awards', decimals: 0 },
            { icon: '🌟', target: 100, prefix: '', suffix: '%', label: 'Client Satisfaction', decimals: 0 },
            { icon: '💼', target: 210, prefix: '', suffix: '+', label: 'Shipped Launches', decimals: 0 }
          ]
        }
      },
      {
        id: 'p_contact',
        widgetType: 'contact',
        props: {
          title: 'Let’s Create Something Iconic Together',
          subtitle: 'Book our studio for upcoming quarter projects or digital consultations.',
          btnText: 'Start Consultation'
        }
      },
      {
        id: 'p_footer',
        widgetType: 'footer',
        props: {
          brandText: 'Studio Lumen',
          brandDesc: 'High-concept creative studio combining typography, geometry, and code.',
          copyright: '© 2026 Studio Lumen. Protected by Argon2id.'
        }
      }
    ]
  }
};
