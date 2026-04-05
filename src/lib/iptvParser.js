import axios from 'axios';
import { iptvOrgApi } from './services/iptvOrgApi';

/**
 * IPTV M3U & EPG Parser
 * Uses iptv-org REST API for reliable channel matching and logo enrichment.
 * Falls back to country-level XML EPG for schedule/program data.
 */
export const iptvParser = {
  /**
   * Fetch channels by country code (M3U)
   */
  async fetchByCountry(countryCode = 'in') {
    const url = `https://iptv-org.github.io/iptv/countries/${countryCode}.m3u`;
    return this.fetchAndParse(url);
  },

  async fetchByLanguage(langCode) {
    const url = `https://iptv-org.github.io/iptv/languages/${langCode}.m3u`;
    return this.fetchAndParse(url);
  },

  async fetchAndParse(url) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return this.parse(response.data);
    } catch (error) {
      console.error('Error fetching M3U:', error);
      throw error;
    }
  },

  parse(m3uText) {
    const lines = m3uText.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        currentChannel = {
          name: '',
          url: '',
          logo: '',
          category: 'Other',
          tvgId: '',
          iptvOrgId: null,
        };

        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) currentChannel.logo = logoMatch[1];

        const categoryMatch = line.match(/group-title="([^"]+)"/);
        if (categoryMatch) currentChannel.category = categoryMatch[1];

        const idMatch = line.match(/tvg-id="([^"]+)"/);
        if (idMatch) currentChannel.tvgId = idMatch[1];

        const nameParts = line.split(',');
        currentChannel.name = nameParts[nameParts.length - 1].trim();
      } else if (line.startsWith('http') && currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
    return channels;
  },

  /**
   * Fetch EPG schedule for a channel using the iptv-org API for ID resolution,
   * then download the country XML for program data.
   *
   * @param {object} channel - { tvgId, name, logo, category, url }
   * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. 'in', 'us')
   * @returns {Promise<Program[]>}
   */
  async fetchEPGForChannel(channel, countryCode = 'in') {
    if (!channel) return [];

    // Step 1: Resolve canonical channel ID via iptv-org API
    let resolvedId = channel.iptvOrgId || null;
    let resolvedTvgId = channel.tvgId || null;

    if (!resolvedId) {
      try {
        const enriched = await iptvOrgApi.enrichChannel(
          channel.tvgId,
          channel.name,
          countryCode.toUpperCase(),
          channel.logo,
        );
        resolvedId = enriched.iptvOrgId;
        console.log(`[EPG] Resolved channel "${channel.name}" → ${resolvedId}`);
      } catch (e) {
        console.warn('[EPG] Channel enrichment failed, will try name matching');
      }
    }

    // Step 2: Fetch country XML and parse
    const sources = [
      `https://iptv-org.github.io/epg/guides/${countryCode.toLowerCase()}.xml`,
      `https://epghub.pages.dev/${countryCode.toLowerCase()}.xml`,
    ];

    for (const source of sources) {
      try {
        console.log(`📡 Fetching EPG XML: ${source}`);
        const response = await axios.get(source, { timeout: 15000 });
        if (response.data) {
          const allPrograms = this.parseEPG(response.data);
          const filtered = this.getProgramsForChannel(
            allPrograms,
            channel,
            resolvedId,
            resolvedTvgId,
          );
          if (filtered.length > 0) {
            console.log(
              `[EPG] Found ${filtered.length} programs for "${channel.name}"`,
            );
            return filtered;
          }
        }
      } catch (error) {
        console.warn(`⚠️ EPG source failed: ${source}`);
      }
    }

    return [];
  },

  /**
   * Parse EPG XML using a lightweight regex-based approach (no cheerio dependency).
   * Returns a flat array of program objects.
   */
  parseEPG(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') return [];
    try {
      const channelMap = {};
      const programs = [];

      // Parse channel display names
      const channelRegex = /<channel id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/g;
      let cm;
      while ((cm = channelRegex.exec(xmlText)) !== null) {
        const id = cm[1];
        const block = cm[2];
        const dnMatch = block.match(/<display-name[^>]*>([^<]+)<\/display-name>/);
        if (dnMatch) {
          channelMap[id] = dnMatch[1].trim().toLowerCase();
        }
      }

      // Parse programmes
      const progRegex = /<programme\s([^>]+)>([\s\S]*?)<\/programme>/g;
      let match;
      while ((match = progRegex.exec(xmlText)) !== null) {
        const attrs = match[1];
        const body = match[2];

        const startAttr = attrs.match(/start="([^"]+)"/);
        const stopAttr = attrs.match(/stop="([^"]+)"/);
        const channelAttr = attrs.match(/channel="([^"]+)"/);

        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/);
        const descMatch = body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
        const iconMatch = body.match(/<icon\s+src="([^"]+)"/);
        const categoryMatch = body.match(/<category[^>]*>([^<]+)<\/category>/);

        const rawStart = startAttr?.[1] || '';
        const rawStop = stopAttr?.[1] || '';
        const channelId = channelAttr?.[1] || '';

        programs.push({
          channelId,
          channelName: channelMap[channelId] || '',
          start: this.formatEPGTime(rawStart),
          stop: this.formatEPGTime(rawStop),
          startTs: this.epgTimeToTimestamp(rawStart),
          stopTs: this.epgTimeToTimestamp(rawStop),
          title: titleMatch?.[1]?.trim() || 'Untitled',
          desc: descMatch?.[1]?.trim().replace(/<[^>]+>/g, '') || '',
          icon: iconMatch?.[1] || null,
          category: categoryMatch?.[1]?.trim() || null,
          rawStart,
          rawStop,
        });
      }

      return programs;
    } catch (e) {
      console.error('[EPG] Parse error:', e);
      return [];
    }
  },

  /**
   * Filter programs for a specific channel using canonical ID (most reliable),
   * tvgId, or fuzzy name matching as fallbacks.
   */
  getProgramsForChannel(allPrograms, channel, resolvedId = null, tvgId = null) {
    if (!channel || !allPrograms?.length) return [];

    const targetTvgId = tvgId || channel.tvgId;
    const targetName = (channel.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const targetResolvedId = resolvedId || channel.iptvOrgId;

    return allPrograms.filter(p => {
      // 1. Canonical iptv-org ID match (most reliable)
      if (targetResolvedId && p.channelId === targetResolvedId) return true;

      // 2. Exact tvgId match
      if (targetTvgId && p.channelId === targetTvgId) return true;

      // 3. Normalized name fuzzy match
      const normalizedChannelName = p.channelName.replace(/[^a-z0-9]/g, '');
      if (
        targetName &&
        normalizedChannelName &&
        (normalizedChannelName.includes(targetName) ||
          targetName.includes(normalizedChannelName))
      ) {
        return true;
      }

      return false;
    });
  },

  /** Format EPG timestamp "20240405120000 +0000" → "12:00" */
  formatEPGTime(timeStr) {
    if (typeof timeStr !== 'string' || timeStr.length < 12) return '';
    const hour = timeStr.substring(8, 10);
    const min = timeStr.substring(10, 12);
    return `${hour}:${min}`;
  },

  /**
   * Convert EPG timestamp to a Unix ms timestamp for live-now detection.
   * Handles "20240405120000 +0530" format including timezone offset.
   */
  epgTimeToTimestamp(timeStr) {
    if (typeof timeStr !== 'string' || timeStr.length < 14) return 0;
    try {
      const year = parseInt(timeStr.substring(0, 4), 10);
      const month = parseInt(timeStr.substring(4, 6), 10) - 1;
      const day = parseInt(timeStr.substring(6, 8), 10);
      const hour = parseInt(timeStr.substring(8, 10), 10);
      const min = parseInt(timeStr.substring(10, 12), 10);
      const sec = parseInt(timeStr.substring(12, 14), 10);

      // Parse optional timezone offset "+0530" or "-0500"
      const tzMatch = timeStr.match(/([+-])(\d{2})(\d{2})/);
      let utcOffsetMs = 0;
      if (tzMatch) {
        const sign = tzMatch[1] === '+' ? 1 : -1;
        const tzH = parseInt(tzMatch[2], 10);
        const tzM = parseInt(tzMatch[3], 10);
        utcOffsetMs = sign * (tzH * 60 + tzM) * 60 * 1000;
      }

      const utcMs = Date.UTC(year, month, day, hour, min, sec) - utcOffsetMs;
      return utcMs;
    } catch {
      return 0;
    }
  },
};
