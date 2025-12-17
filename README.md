# Voca - AI Voice Assistant Platform

A professional, responsive, and engaging SaaS-style website for AI voice assistants, built with Next.js, Tailwind CSS, and Web Speech API.

![Voca AI Platform](https://img.shields.io/badge/Next.js-14.0.4-black?style=for-the-badge&logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)

## 🚀 Features

### Core Features
- **AI Voice Assistant**: Real-time voice recognition and synthesis using Web Speech API
- **Interactive Chat Interface**: Modern chat UI with voice and text input
- **Responsive Design**: Mobile-first design that works on all devices
- **Industry Solutions**: Tailored voice AI solutions for various industries
- **Professional UI/UX**: Modern, engaging design with smooth animations

### Technical Features
- **Next.js 14**: App Router with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **Web Speech API**: Browser-native voice recognition and synthesis
- **Lucide React**: Beautiful, customizable icons
- **Responsive Layout**: Mobile, tablet, and desktop optimized

### Industry Verticals
- **E-commerce**: Voice shopping assistants and product search
- **Healthcare**: Patient care and medical transcription
- **Education**: Language learning and accessibility tools
- **Finance**: Voice banking and investment advice
- **Automotive**: In-car voice control and navigation
- **Travel & Hospitality**: Booking assistance and concierge services
- **Real Estate**: Property search and virtual tours
- **Enterprise**: Business operations and team collaboration

## 📁 Project Structure

```
voca-ai/
├── app/                          # Next.js App Router
│   ├── globals.css              # Global styles and Tailwind imports
│   ├── layout.tsx               # Root layout component
│   ├── page.tsx                 # Home page
│   ├── industries/              # Industries page
│   │   └── page.tsx
│   └── chat-agent/              # Chat agent page
│       └── page.tsx
├── components/                   # React components
│   ├── layout/                  # Layout components
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── sections/                # Page sections
│   │   ├── HeroSection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── IndustriesSection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   └── CTASection.tsx
│   ├── chat/                    # Chat components
│   │   ├── VoiceAssistant.tsx
│   │   └── ChatInterface.tsx
│   └── cards/                   # Card components
│       └── IndustryCard.tsx
├── public/                      # Static assets
├── package.json                 # Dependencies and scripts
├── tailwind.config.js          # Tailwind configuration
├── next.config.js              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern browser with Web Speech API support

### 1. Clone the Repository
```bash
git clone <repository-url>
cd voca-ai
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Run Development Server
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### 4. Build for Production
```bash
npm run build
# or
yarn build
```

### 5. Start Production Server
```bash
npm start
# or
yarn start
```

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Follow the prompts** to connect your GitHub repository and deploy.

### Deploy to Other Platforms

The project is compatible with any platform that supports Next.js:

- **Netlify**: Connect your GitHub repository and build with `npm run build`
- **Railway**: Deploy directly from GitHub
- **DigitalOcean App Platform**: Connect your repository
- **AWS Amplify**: Connect your repository and build automatically

## 🎨 Customization

### Colors and Theme
Modify the color scheme in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0f9ff',
        500: '#0ea5e9',
        600: '#0284c7',
        // ... more shades
      },
      secondary: {
        50: '#fdf4ff',
        500: '#d946ef',
        600: '#c026d3',
        // ... more shades
      },
    },
  },
}
```

### Voice Assistant Configuration
Customize voice settings in `app/chat-agent/page.tsx`:

```typescript
// Speech recognition settings
recognitionRef.current.lang = 'en-US' // Change language
recognitionRef.current.continuous = false // Enable continuous listening

// Speech synthesis settings
utterance.rate = 0.9 // Speech rate (0.1 to 10)
utterance.pitch = 1 // Pitch (0 to 2)
utterance.volume = 0.8 // Volume (0 to 1)
```

### Industry Data
Add or modify industries in `app/industries/page.tsx`:

```typescript
const industries = [
  {
    id: 'your-industry',
    title: 'Your Industry',
    description: 'Description of your industry solution',
    icon: YourIcon,
    features: ['Feature 1', 'Feature 2'],
    color: 'from-blue-500 to-purple-600',
    useCases: ['Use case 1', 'Use case 2']
  },
  // ... more industries
]
```

## 🔧 API Integration

### Connect to AI Services
To integrate with real AI services, modify the `generateAIResponse` function in `app/chat-agent/page.tsx`:

```typescript
const generateAIResponse = async (userInput: string): Promise<string> => {
  // Example: OpenAI API integration
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: userInput }),
  });
  
  const data = await response.json();
  return data.response;
}
```

### Environment Variables
Create a `.env.local` file for API keys:

```env
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📱 Browser Support

The Web Speech API is supported in:
- Chrome 25+
- Safari 7+
- Firefox 44+
- Edge 79+

For unsupported browsers, the app gracefully falls back to text-only input.

## 🚀 Performance Optimization

### Built-in Optimizations
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic code splitting by pages
- **Tree Shaking**: Unused CSS and JavaScript removal
- **Lazy Loading**: Components load on demand
- **Caching**: Static assets cached for performance

### Additional Optimizations
- **Bundle Analysis**: Run `npm run build` to see bundle size
- **Lighthouse**: Test performance with Chrome DevTools
- **Core Web Vitals**: Monitor loading performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Email: hello@voca.ai
- 📞 Phone: +1 (555) 123-4567
- 🌐 Website: [voca.ai](https://voca.ai)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Lucide](https://lucide.dev/) - Icon library
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - Voice recognition and synthesis

---

**Built with ❤️ by the Voca Team**
