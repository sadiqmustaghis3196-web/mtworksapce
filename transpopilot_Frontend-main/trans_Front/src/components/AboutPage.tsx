import React from 'react';
import { 
  Users, 
  Award, 
  Target, 
  TrendingUp,
  Shield,
  Truck,
  Brain,
  Globe
} from 'lucide-react';

const AboutPage: React.FC = () => {
  const team = [
    {
      name: "Alex Johnson",
      role: "CEO & Co-Founder",
      bio: "Former VP of Operations at major logistics company. 15+ years in transportation industry.",
      avatar: "AJ",
      linkedin: "#"
    },
    {
      name: "Sarah Chen",
      role: "CTO & Co-Founder", 
      bio: "Ex-Google AI engineer. PhD in Machine Learning from Stanford. Built AI systems for autonomous vehicles.",
      avatar: "SC",
      linkedin: "#"
    },
    {
      name: "Mike Rodriguez",
      role: "Head of Product",
      bio: "Former fleet manager turned product expert. Deep understanding of trucking operations and pain points.",
      avatar: "MR",
      linkedin: "#"
    },
    {
      name: "Dr. Lisa Wang",
      role: "Head of AI Research",
      bio: "Former Tesla Autopilot team member. Specializes in route optimization and predictive analytics.",
      avatar: "LW",
      linkedin: "#"
    }
  ];

  const stats = [
    { number: "500+", label: "Trucking Companies" },
    { number: "25,000+", label: "Vehicles Managed" },
    { number: "$50M+", label: "Fuel Savings Generated" },
    { number: "98.7%", label: "Average Compliance Rate" }
  ];

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We're committed to revolutionizing the trucking industry through intelligent technology that saves money and improves safety."
    },
    {
      icon: Shield,
      title: "Safety First",
      description: "Every feature we build prioritizes driver safety and regulatory compliance above all else."
    },
    {
      icon: TrendingUp,
      title: "Continuous Innovation",
      description: "We constantly evolve our AI algorithms to deliver better results and stay ahead of industry changes."
    },
    {
      icon: Users,
      title: "Customer Success",
      description: "Our success is measured by our customers' success. We're partners in your growth journey."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900/60">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-6">
            About TranspoPilot
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            We're on a mission to transform the trucking industry through artificial intelligence, 
            helping companies save millions while improving safety and compliance.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-[#05070f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-3xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Story Section */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Our Story</h2>
          </div>
          <div className="prose prose-lg mx-auto text-slate-300">
            <p>
              TranspoPilot was born from a simple observation: the trucking industry, which moves 
              70% of America's freight, was still operating with outdated technology and manual processes 
              that cost companies millions in inefficiencies.
            </p>
            <p>
              Our founders, Alex Johnson and Sarah Chen, met while working on logistics optimization 
              at different companies. Alex, with his deep trucking industry experience, saw firsthand 
              how fleet managers struggled with fuel costs, compliance issues, and driver management. 
              Sarah, an AI engineer from Google, recognized that modern machine learning could solve 
              these problems at scale.
            </p>
            <p>
              In 2023, they joined forces to create TranspoPilot - the first comprehensive 
              transportation management platform powered by artificial intelligence. Our goal was 
              simple: help trucking companies save money, improve safety, and stay compliant while 
              making their operations more efficient.
            </p>
            <p>
              Today, we're proud to serve over 500 trucking companies, managing more than 25,000 
              vehicles, and have generated over $50 million in fuel savings for our customers. 
              But we're just getting started.
            </p>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="py-16 bg-[#05070f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Meet Our Team</h2>
            <p className="text-slate-400">Industry experts and AI pioneers working together</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="bg-slate-900/60 rounded-lg shadow-lg p-6 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-semibold text-blue-600">{member.avatar}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                <p className="text-blue-600 font-medium mb-3">{member.role}</p>
                <p className="text-sm text-slate-400">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Our Values</h2>
            <p className="text-slate-400">The principles that guide everything we do</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                    <p className="text-slate-400">{value.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technology Section */}
      <div className="py-16 bg-[#05070f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Our Technology</h2>
            <p className="text-slate-400">Cutting-edge AI built specifically for transportation</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Machine Learning</h3>
              <p className="text-slate-400">
                Advanced algorithms that learn from your fleet's data to provide increasingly 
                accurate predictions and optimizations.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Real-Time Processing</h3>
              <p className="text-slate-400">
                Cloud-based infrastructure that processes millions of data points in real-time 
                to deliver instant insights and recommendations.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Enterprise Security</h3>
              <p className="text-slate-400">
                Bank-level encryption and security protocols ensure your sensitive fleet 
                data is always protected and compliant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Join Our Mission?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Whether you're a trucking company looking to optimize operations or a talented 
            individual wanting to revolutionize transportation, we'd love to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-slate-900/60 text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors">
              Start Free Trial
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-slate-900/60 hover:text-blue-600 transition-colors">
              View Careers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;