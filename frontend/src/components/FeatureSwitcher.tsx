import React from 'react';
import { FEATURES } from '../config/features';
import { 
  FileText, 
  Image as ImageIcon, 
  Mic, 
  Headphones, 
  Video, 
  BarChart3 
} from 'lucide-react';

interface FeatureSwitcherProps {
  activeFeatureId: string;
  onSelectFeature: (featureRoute: string) => void;
}

export const FeatureSwitcher: React.FC<FeatureSwitcherProps> = ({
  activeFeatureId,
  onSelectFeature,
}) => {
  const getIcon = (id: string, size = 14) => {
    switch (id) {
      case 'document-analysis':
        return <FileText size={size} />;
      case 'visual-intelligence':
        return <ImageIcon size={size} />;
      case 'ai-interview':
        return <Mic size={size} />;
      case 'customer-support':
        return <Headphones size={size} />;
      case 'video-audio-review':
        return <Video size={size} />;
      case 'data-study':
      default:
        return <BarChart3 size={size} />;
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl backdrop-blur-md shadow-inner overflow-x-auto max-w-full scrollbar-none transition-colors duration-200">
      {FEATURES.map((feat) => {
        const isActive =
          activeFeatureId === feat.id ||
          activeFeatureId === feat.route.replace('/', '') ||
          (feat.aliases && feat.aliases.includes(activeFeatureId));

        return (
          <button
            key={feat.id}
            onClick={() => onSelectFeature(feat.route)}
            title={feat.title}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className={isActive ? 'text-white' : feat.colorScheme.text}>
              {getIcon(feat.id, 14)}
            </span>
            <span className="hidden lg:inline">{feat.title}</span>
            <span className="lg:hidden">{feat.title.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
};
