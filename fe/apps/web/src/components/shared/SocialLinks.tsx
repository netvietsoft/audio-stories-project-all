"use client";

import { useEffect, useState } from 'react';
import { Facebook, Send, MessageCircle, Instagram, Twitter, Youtube, Music } from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';

type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  iconUrl?: string;
  orderIndex: number;
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  telegram: Send,
  zalo: MessageCircle,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  tiktok: Music,
  discord: MessageCircle,
  reddit: MessageCircle,
};

const platformNames: Record<string, Record<string, string>> = {
  facebook: { vi: 'Facebook', en: 'Facebook' },
  telegram: { vi: 'Telegram', en: 'Telegram' },
  zalo: { vi: 'Zalo', en: 'Zalo' },
  instagram: { vi: 'Instagram', en: 'Instagram' },
  twitter: { vi: 'Twitter/X', en: 'Twitter/X' },
  youtube: { vi: 'YouTube', en: 'YouTube' },
  tiktok: { vi: 'TikTok', en: 'TikTok' },
  discord: { vi: 'Discord', en: 'Discord' },
  reddit: { vi: 'Reddit', en: 'Reddit' },
  other: { vi: 'Khác', en: 'Other' },
};

const platformColors: Record<string, { icon: string; border: string; hover: string }> = {
  facebook: {
    icon: 'text-[#1877F2]',
    border: 'border-[#1877F2]/30',
    hover: 'hover:border-[#1877F2] hover:bg-[#1877F2]/5',
  },
  telegram: {
    icon: 'text-[#0088CC]',
    border: 'border-[#0088CC]/30',
    hover: 'hover:border-[#0088CC] hover:bg-[#0088CC]/5',
  },
  zalo: {
    icon: 'text-[#0068FF]',
    border: 'border-[#0068FF]/30',
    hover: 'hover:border-[#0068FF] hover:bg-[#0068FF]/5',
  },
  instagram: {
    icon: 'text-[#E1306C]',
    border: 'border-[#E1306C]/30',
    hover: 'hover:border-[#E1306C] hover:bg-gradient-to-br hover:from-[#833AB4]/5 hover:via-[#FD1D1D]/5 hover:to-[#F77737]/5',
  },
  twitter: {
    icon: 'text-[#000000] dark:text-white',
    border: 'border-gray-400 dark:border-gray-500',
    hover: 'hover:border-gray-900 hover:bg-gray-50 dark:hover:border-gray-400 dark:hover:bg-gray-800',
  },
  youtube: {
    icon: 'text-[#FF0000]',
    border: 'border-[#FF0000]/30',
    hover: 'hover:border-[#FF0000] hover:bg-[#FF0000]/5',
  },
  tiktok: {
    icon: 'text-[#000000] dark:text-white',
    border: 'border-gray-400 dark:border-gray-500',
    hover: 'hover:border-gray-900 hover:bg-gray-50 dark:hover:border-gray-400 dark:hover:bg-gray-800',
  },
  discord: {
    icon: 'text-[#5865F2]',
    border: 'border-[#5865F2]/30',
    hover: 'hover:border-[#5865F2] hover:bg-[#5865F2]/5',
  },
  reddit: {
    icon: 'text-[#FF4500]',
    border: 'border-[#FF4500]/30',
    hover: 'hover:border-[#FF4500] hover:bg-[#FF4500]/5',
  },
};

export default function SocialLinks() {
  const locale = useLocale() as 'vi' | 'en';
  const t = useTranslations('SocialLinks');
  const [links, setLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const response = await apiClient.get('/social-links');
        setLinks(unwrapList<SocialLink>(response.data));
      } catch (error) {
        console.error('Failed to fetch social links:', error);
      }
    };

    void fetchLinks();
  }, []);

  if (links.length === 0) return null;

  const getTooltip = (platform: string) => {
    const platformName = platformNames[platform]?.[locale] || platformNames.other?.[locale] || 'Other';
    return locale === 'vi'
      ? `Tham gia cộng đồng trên ${platformName}`
      : `Join our community on ${platformName}`;
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
        {t('communities')}
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {links.map((link) => {
          const Icon = platformIcons[link.platform] || MessageCircle;
          const colors = platformColors[link.platform] || {
            icon: 'text-gray-600 dark:text-gray-300',
            border: 'border-gray-300 dark:border-gray-600',
            hover: 'hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
          };

          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label || getTooltip(link.platform)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white dark:bg-[#242526] shadow-sm transition-all ${colors.border} ${colors.hover}`}
            >
              {link.iconUrl ? (
                <Image src={link.iconUrl} alt={link.label} width={20} height={20} className="h-5 w-5 object-contain" unoptimized />
              ) : (
                <Icon className={`h-5 w-5 ${colors.icon}`} />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
