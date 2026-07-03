export type CityWeather = {
  city: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
};

const CITIES = [
  { city: "ירושלים", latitude: 31.7683, longitude: 35.2137 },
  { city: "תל אביב", latitude: 32.0853, longitude: 34.7818 },
  { city: "חיפה", latitude: 32.7940, longitude: 34.9896 },
];

export async function getWeatherForBroadcastTeams(): Promise<CityWeather[]> {
  const results = await Promise.all(
    CITIES.map(async (city) => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,wind_speed_10m,weather_code&timezone=Asia%2FJerusalem`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Weather API failed");

      const data = await res.json();

      return {
        city: city.city,
        temperature: Math.round(data.current.temperature_2m),
        windSpeed: Math.round(data.current.wind_speed_10m),
        weatherCode: data.current.weather_code,
      };
    })
  );

  return results;
}
