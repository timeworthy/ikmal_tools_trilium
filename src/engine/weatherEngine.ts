/**
 * Weather lookup for the Today Homepage.
 *
 * Uses Open-Meteo, which needs no API key or account and returns no identifiers,
 * so the only thing that leaves the browser is the coordinates the user entered.
 * The request is made from the client because Trilium runs without a Content
 * Security Policy; nothing here touches the plugin's backend.
 */

import { WeatherConfig } from './types.js';

const API_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherDay {
    /** ISO date, `YYYY-MM-DD`. */
    date: string;
    high: number;
    low: number;
    condition: WeatherCondition;
}

export interface WeatherReport {
    temperature: number;
    windSpeed: number;
    isDay: boolean;
    condition: WeatherCondition;
    /** Today first, then the next two days. */
    days: WeatherDay[];
    temperatureUnit: string;
    windUnit: string;
    /** Today's sunrise/sunset, ISO local time strings as Open-Meteo returns them. */
    sunrise: string | null;
    sunset: string | null;
    daylightSeconds: number | null;
}

export interface WeatherCondition {
    /** Boxicons class without the `bx-` prefix. */
    icon: string;
    label: string;
}

/**
 * WMO weather interpretation codes, as returned in `weather_code`.
 * See https://open-meteo.com/en/docs — the codes are sparse, so anything
 * unlisted falls back to a neutral cloud.
 */
const WMO_CODES: Record<number, WeatherCondition> = {
    0: { icon: 'sun', label: 'Clear' },
    1: { icon: 'sun', label: 'Mainly clear' },
    2: { icon: 'cloud', label: 'Partly cloudy' },
    3: { icon: 'cloud', label: 'Overcast' },
    45: { icon: 'water', label: 'Fog' },
    48: { icon: 'water', label: 'Freezing fog' },
    51: { icon: 'cloud-drizzle', label: 'Light drizzle' },
    53: { icon: 'cloud-drizzle', label: 'Drizzle' },
    55: { icon: 'cloud-drizzle', label: 'Heavy drizzle' },
    56: { icon: 'cloud-drizzle', label: 'Freezing drizzle' },
    57: { icon: 'cloud-drizzle', label: 'Freezing drizzle' },
    61: { icon: 'cloud-light-rain', label: 'Light rain' },
    63: { icon: 'cloud-rain', label: 'Rain' },
    65: { icon: 'cloud-rain', label: 'Heavy rain' },
    66: { icon: 'cloud-rain', label: 'Freezing rain' },
    67: { icon: 'cloud-rain', label: 'Freezing rain' },
    71: { icon: 'cloud-snow', label: 'Light snow' },
    73: { icon: 'cloud-snow', label: 'Snow' },
    75: { icon: 'cloud-snow', label: 'Heavy snow' },
    77: { icon: 'cloud-snow', label: 'Snow grains' },
    80: { icon: 'cloud-light-rain', label: 'Light showers' },
    81: { icon: 'cloud-rain', label: 'Showers' },
    82: { icon: 'cloud-rain', label: 'Heavy showers' },
    85: { icon: 'cloud-snow', label: 'Snow showers' },
    86: { icon: 'cloud-snow', label: 'Heavy snow showers' },
    95: { icon: 'cloud-lightning', label: 'Thunderstorm' },
    96: { icon: 'cloud-lightning', label: 'Thunderstorm with hail' },
    99: { icon: 'cloud-lightning', label: 'Thunderstorm with hail' },
};

export function describeWeatherCode(code: number, isDay = true): WeatherCondition {
    const condition = WMO_CODES[code] ?? { icon: 'cloud', label: 'Unknown' };
    // A clear night is a moon, not a sun; everything else looks the same after dark.
    if (!isDay && condition.icon === 'sun') {
        return { icon: 'moon', label: condition.label };
    }
    return condition;
}

export function buildWeatherUrl({ latitude, longitude, units }: WeatherConfig): string {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,is_day,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration',
        timezone: 'auto',
        forecast_days: '3',
    });

    if (units === 'imperial') {
        params.set('temperature_unit', 'fahrenheit');
        params.set('wind_speed_unit', 'mph');
    }

    return `${API_URL}?${params.toString()}`;
}

/** True when the coordinates are usable — (0, 0) counts as unset, not the Atlantic. */
export function hasLocation(weather: WeatherConfig | undefined): weather is WeatherConfig {
    if (!weather) return false;
    const { latitude, longitude } = weather;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    if (latitude === 0 && longitude === 0) return false;
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function parseWeatherResponse(data: any): WeatherReport {
    const current = data?.current ?? {};
    const daily = data?.daily ?? {};
    const units = data?.current_units ?? {};
    const isDay = current.is_day !== 0;

    const days: WeatherDay[] = (daily.time ?? []).map((date: string, i: number) => ({
        date,
        high: Math.round(daily.temperature_2m_max?.[i]),
        low: Math.round(daily.temperature_2m_min?.[i]),
        // Daily codes summarise the whole day, so they always read as daytime.
        condition: describeWeatherCode(daily.weather_code?.[i], true),
    }));

    return {
        temperature: Math.round(current.temperature_2m),
        windSpeed: Math.round(current.wind_speed_10m),
        isDay,
        condition: describeWeatherCode(current.weather_code, isDay),
        days,
        temperatureUnit: units.temperature_2m ?? '°',
        windUnit: units.wind_speed_10m ?? '',
        sunrise: daily.sunrise?.[0] ?? null,
        sunset: daily.sunset?.[0] ?? null,
        daylightSeconds: typeof daily.daylight_duration?.[0] === 'number' ? Math.round(daily.daylight_duration[0]) : null,
    };
}

export async function fetchWeather(weather: WeatherConfig, signal?: AbortSignal): Promise<WeatherReport> {
    if (signal?.aborted) {
        // Nothing to clean up yet, and the fetch below would otherwise ignore
        // an already-aborted caller signal and run to completion.
        throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Distinguishes our own 5s deadline from a caller-initiated cancel, which
    // must stay an AbortError so callers can still recognise it.
    let timedOut = false;
    const timeoutId = controller
        ? setTimeout(() => {
              timedOut = true;
              controller.abort();
          }, 5000)
        : null;

    const forwardAbort = () => controller?.abort();
    if (signal && controller) {
        signal.addEventListener('abort', forwardAbort);
    }

    const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        // A long-lived caller signal reused across calls would otherwise
        // accumulate one listener per request.
        signal?.removeEventListener('abort', forwardAbort);
    };

    try {
        const response = await fetch(buildWeatherUrl(weather), {
            signal: controller?.signal || signal
        });
        cleanup();
        if (!response.ok) {
            throw new Error(`Weather service returned ${response.status}`);
        }
        return parseWeatherResponse(await response.json());
    } catch (err: any) {
        cleanup();
        // Only our own deadline becomes a timeout message; a caller's cancel
        // propagates unchanged so `err.name === 'AbortError'` stays meaningful.
        if (timedOut && err?.name === 'AbortError') {
            throw new Error('Weather request timed out after 5 seconds');
        }
        throw err;
    }
}
