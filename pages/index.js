import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Funkcja pobierająca dane pogodowe
  const fetchWeather = async () => {
    if (!city.trim()) {
      setError('Wprowadź nazwę miasta');
      return;
    }

    setLoading(true);
    setError('');
    setWeather(null);

    try {
      // Najpierw pobieramy współrzędne geograficzne miasta
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
      const geoResponse = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'PogodaDlaRowerzysty/1.0'
        }
      });
      
      const geoData = await geoResponse.json();
      
      if (!geoData || geoData.length === 0) {
        throw new Error(`Nie można znaleźć miasta '${city}'`);
      }
      
      const lat = geoData[0].lat;
      const lon = geoData[0].lon;
      const displayName = geoData[0].display_name.split(',')[0];
      
      // Teraz pobieramy dane pogodowe na podstawie współrzędnych
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,winddirection_10m,weathercode&windspeed_unit=ms&forecast_days=3&timezone=auto`;
      
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();
      
      // Przygotowujemy dane do wyświetlenia
      const processedData = processWeatherData(weatherData, displayName);
      setWeather(processedData);
    } catch (err) {
      setError(err.message || 'Wystąpił błąd podczas pobierania danych pogodowych');
    } finally {
      setLoading(false);
    }
  };

  // Funkcja przetwarzająca dane pogodowe
  const processWeatherData = (data, cityName) => {
    const days = [];
    const today = new Date();
    
    // Przetwarzamy dane na 3 dni
    for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayIndex);
      
      const dayName = date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
      
      // Definiujemy przedziały godzinowe
      const timeRanges = [
        { name: 'Rano (8:00-10:00)', startHour: 8, endHour: 10 },
        { name: 'Południe (10:00-14:00)', startHour: 10, endHour: 14 },
        { name: 'Popołudnie (14:00-18:00)', startHour: 14, endHour: 18 }
      ];
      
      const dayData = {
        name: dayName,
        ranges: []
      };
      
      // Dla każdego przedziału czasowego obliczamy średnie wartości
      timeRanges.forEach(range => {
        const rangeData = calculateRangeData(data, dayIndex, range.startHour, range.endHour);
        dayData.ranges.push({
          name: range.name,
          ...rangeData
        });
      });
      
      days.push(dayData);
    }
    
    return {
      city: cityName,
      days
    };
  };

  // Funkcja obliczająca średnie wartości dla przedziału czasowego
  const calculateRangeData = (data, dayIndex, startHour, endHour) => {
    const startIndex = dayIndex * 24 + startHour;
    const endIndex = dayIndex * 24 + endHour;
    
    let sumTemp = 0;
    let sumHumidity = 0;
    let sumWind = 0;
    let maxRain = 0;
    let weatherCodes = {};
    let windDirections = [];
    
    // Pobieramy dane dla wybranego zakresu godzin
    for (let i = startIndex; i < endIndex; i++) {
      if (i < data.hourly.time.length) {
        sumTemp += data.hourly.temperature_2m[i];
        sumHumidity += data.hourly.relativehumidity_2m[i];
        sumWind += data.hourly.windspeed_10m[i];
        
        const rainAmount = data.hourly.precipitation[i];
        if (rainAmount > maxRain) maxRain = rainAmount;
        
        const weatherCode = data.hourly.weathercode[i];
        weatherCodes[weatherCode] = (weatherCodes[weatherCode] || 0) + 1;
        
        windDirections.push(data.hourly.winddirection_10m[i]);
      }
    }
    
    const hoursCount = endHour - startHour;
    
    // Obliczamy średnie wartości
    const avgTemp = sumTemp / hoursCount;
    const avgHumidity = sumHumidity / hoursCount;
    const avgWind = sumWind / hoursCount;
    
    // Znajdujemy dominujący kod pogody
    let dominantWeatherCode = 0;
    let maxCount = 0;
    
    for (const code in weatherCodes) {
      if (weatherCodes[code] > maxCount) {
        maxCount = weatherCodes[code];
        dominantWeatherCode = parseInt(code);
      }
    }
    
    // Obliczamy średni kierunek wiatru
    const normalizedWindDir = calculateAverageWindDirection(windDirections);
    
    // Sprawdzamy, czy będzie padać
    const willRain = maxRain > 0.1;
    
    return {
      avgTemp,
      avgHumidity,
      avgWind,
      maxRain,
      dominantWeatherCode,
      normalizedWindDir,
      willRain
    };
  };

  // Funkcja obliczająca średni kierunek wiatru
  const calculateAverageWindDirection = (directions) => {
    if (directions.length === 0) return 0;
    
    let sumSin = 0;
    let sumCos = 0;
    
    directions.forEach(deg => {
      const rad = (deg * Math.PI) / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    });
    
    const avgRad = Math.atan2(sumSin, sumCos);
    let avgDeg = (avgRad * 180) / Math.PI;
    
    if (avgDeg < 0) avgDeg += 360;
    
    return Math.round(avgDeg);
  };

  // Funkcja zwracająca opis kierunku wiatru
  const getWindDirection = (degrees) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const polishNames = ['Północ', 'Północny-Wschód', 'Wschód', 'Południowy-Wschód', 'Południe', 'Południowy-Zachód', 'Zachód', 'Północny-Zachód'];
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']; // Strzałki kierunku
    
    const index = Math.round(degrees / 45) % 8;
    
    return (
      <span>
        <span className={styles.windArrow}>{arrows[index]}</span>
        {' '}{directions[index]} ({polishNames[index]}, {degrees}°)
      </span>
    );
  };

  // Funkcja zwracająca opis pogody na podstawie kodu
  const getWeatherDescription = (code) => {
    const weatherCodes = {
      0: {icon: '☀️', desc: "bezchmurnie"},
      1: {icon: '⛅', desc: "przeważnie bezchmurnie"},
      2: {icon: '⛅', desc: "częściowe zachmurzenie"},
      3: {icon: '☁️', desc: "pochmurno"},
      45: {icon: '🌫️', desc: "mgła"},
      48: {icon: '🌫️', desc: "osadzająca się mgła"},
      51: {icon: '🌧️', desc: "lekka mżawka"},
      53: {icon: '🌧️', desc: "umiarkowana mżawka"},
      55: {icon: '🌧️', desc: "gęsta mżawka"},
      56: {icon: '🌧️❄️', desc: "lekkie marznące opady"},
      57: {icon: '🌧️❄️', desc: "gęste marznące opady"},
      61: {icon: '🌧️', desc: "lekki deszcz"},
      63: {icon: '🌧️', desc: "umiarkowany deszcz"},
      65: {icon: '🌧️', desc: "silny deszcz"},
      66: {icon: '🌧️❄️', desc: "lekki marznący deszcz"},
      67: {icon: '🌧️❄️', desc: "silny marznący deszcz"},
      71: {icon: '❄️', desc: "lekkie opady śniegu"},
      73: {icon: '❄️', desc: "umiarkowane opady śniegu"},
      75: {icon: '❄️', desc: "silne opady śniegu"},
      77: {icon: '❄️', desc: "ziarna śniegu"},
      80: {icon: '🌧️', desc: "lekkie przelotne opady"},
      81: {icon: '🌧️', desc: "umiarkowane przelotne opady"},
      82: {icon: '🌧️', desc: "gwałtowne przelotne opady"},
      85: {icon: '❄️', desc: "lekkie opady śniegu"},
      86: {icon: '❄️', desc: "silne opady śniegu"},
      95: {icon: '⚡', desc: "burza"},
      96: {icon: '⚡', desc: "burza z lekkim gradem"},
      99: {icon: '⚡', desc: "burza z silnym gradem"}
    };
    
    const weather = weatherCodes[code] || {icon: '❓', desc: "nieznana pogoda"};
    
    return (
      <span>
        <span className={styles.weatherIcon}>{weather.icon}</span> {weather.desc}
      </span>
    );
  };

  // Funkcja sugerująca ubiór na podstawie warunków pogodowych
  const suggestClothes = (temperatura, predkoscWiatru, deszcz, kierunekWiatru) => {
    const typowy = generateClothingSuggestion(temperatura, predkoscWiatru, deszcz, kierunekWiatru, false);
    const mors = generateClothingSuggestion(temperatura, predkoscWiatru, deszcz, kierunekWiatru, true);
    
    return (
      <>
        <h3>Sugerowany ubiór:</h3>
        <div className={styles.clothesCategory}>
          <h4>1. Typowy rowerzysta</h4>
          <p>{typowy}</p>
        </div>
        <div className={styles.clothesCategory}>
          <h4>2. Mors rowerzysta</h4>
          <p>{mors}</p>
        </div>
      </>
    );
  };

  // Funkcja generująca sugestie ubioru
  const generateClothingSuggestion = (temperatura, predkoscWiatru, deszcz, kierunekWiatru, isMors) => {
    let sugestie = [];
    
    // Odczuwalna temperatura jest niższa przy silnym wietrze
    const odczuwalnaTemperatura = temperatura - (predkoscWiatru / 3);
    
    // Warstwowość ubioru
    if (isMors) {
      // Dla "morsa" o jedną warstwę mniej
      if (odczuwalnaTemperatura < 0) {
        sugestie.push("cienka bielizna termiczna");
        sugestie.push("koszulka z długim rękawem");
      } else if (odczuwalnaTemperatura < 10) {
        sugestie.push("koszulka z długim rękawem");
      } else {
        sugestie.push("koszulka z krótkim rękawem");
      }
    } else {
      // Dla zwykłego rowerzysty
      if (odczuwalnaTemperatura < 0) {
        sugestie.push("gruba bielizna termiczna");
        sugestie.push("koszulka z długim rękawem");
        sugestie.push("ciepła bluza");
      } else if (odczuwalnaTemperatura < 10) {
        sugestie.push("cienka bielizna termiczna");
        sugestie.push("koszulka z długim rękawem");
        sugestie.push("lekka bluza");
      } else if (odczuwalnaTemperatura < 20) {
        sugestie.push("koszulka z długim rękawem");
      } else {
        sugestie.push("koszulka z krótkim rękawem");
      }
    }
    
    // Zewnętrzna warstwa - kurtka
    if (deszcz) {
      sugestie.push("kurtka przeciwdeszczowa");
    } else if (predkoscWiatru > 5 && odczuwalnaTemperatura < 15) {
      sugestie.push("kurtka wiatrówka");
    }
    
    // Dolna część ubioru
    if (odczuwalnaTemperatura < 5) {
      if (!isMors) {
        sugestie.push("ocieplane spodnie rowerowe długie");
      } else {
        sugestie.push("standardowe spodnie rowerowe długie");
      }
    } else if (odczuwalnaTemperatura < 15) {
      sugestie.push("spodnie rowerowe długie");
    } else {
      sugestie.push("spodnie rowerowe krótkie");
    }
    
    // Dodatki
    if (odczuwalnaTemperatura < 5) {
      if (!isMors) {
        sugestie.push("ocieplana czapka pod kask");
        sugestie.push("grube rękawiczki");
        sugestie.push("ocieplane buty rowerowe lub ochraniacze na buty");
      } else {
        sugestie.push("cienka czapka pod kask");
        sugestie.push("lekkie rękawiczki");
      }
    } else if (odczuwalnaTemperatura < 10) {
      if (!isMors) {
        sugestie.push("cienka czapka pod kask");
        sugestie.push("lekkie rękawiczki");
      }
    } else if (temperatura > 25) {
      sugestie.push("przewiewna czapka z daszkiem pod kask");
    }
    
    // Akcesoria dodatkowe
    if (deszcz) {
      sugestie.push("ochraniacze przeciwdeszczowe na buty");
    }
    
    // Wiatr - sugestie dotyczące trasy
    if (predkoscWiatru > 4) {
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const polishNames = ['północny', 'północno-wschodni', 'wschodni', 'południowo-wschodni', 'południowy', 'południowo-zachodni', 'zachodni', 'północno-zachodni'];
      
      const index = Math.round(kierunekWiatru / 45) % 8;
      const przeciwnyIndex = (index + 4) % 8;
      
      sugestie.push(`Uwaga! Silny wiatr ${polishNames[index]}. Na powrocie do Dąbrowy Górniczej wybierz trasę z wiatrem ${polishNames[przeciwnyIndex]} (mniej więcej w kierunku ${directions[przeciwnyIndex]}).`);
    }
    
    return sugestie.join(", ") + ".";
  };

  // Funkcja określająca klasę dla prędkości wiatru
  const getWindClass = (speed) => {
    if (speed <= 3) return styles.windLow;
    if (speed <= 5) return styles.windMedium;
    return styles.windHigh;
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Pogoda dla Rowerzystów</title>
        <meta name="description" content="Aplikacja pogodowa dla rowerzystów z rekomendacjami ubioru" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Pogoda dla Rowerzystów</h1>
          <p className={styles.description}>
            Sprawdź prognozę i dowiedz się, jak się ubrać na rower!
          </p>
        </header>

        <div className={styles.searchBox}>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Wpisz nazwę miasta..."
            className={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && fetchWeather()}
          />
          <button onClick={fetchWeather} className={styles.button}>
            Sprawdź
          </button>
        </div>

        {loading && <div className={styles.loading}>Pobieranie danych pogodowych...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {weather && (
          <div className={styles.weatherContainer}>
            <div className={styles.cityInfo}>
              <h2>{weather.city}</h2>
              <div className={styles.weatherIcon}>
                <span className={styles.bikeIcon}>🚲</span>
                <span className={styles.sunIcon}>☀️</span>
              </div>
            </div>

            {weather.days.map((day, dayIndex) => (
              <div key={dayIndex} className={`${styles.dayForecast} ${styles['day' + dayIndex]}`}>
                <h2 className={styles.dayTitle}>{day.name}</h2>
                
                <div className={styles.hourlyForecast}>
                  <table className={styles.forecastTable}>
                    <thead>
                      <tr>
                        <th>Czas</th>
                        <th>Temperatura</th>
                        <th>Wilgotność</th>
                        <th>Wiatr</th>
                        <th>Kierunek wiatru</th>
                        <th>Opady</th>
                        <th>Pogoda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.ranges.map((range, rangeIndex) => (
                        <tr key={rangeIndex}>
                          <td>{range.name}</td>
                          <td>{range.avgTemp.toFixed(1)} °C</td>
                          <td>{Math.round(range.avgHumidity)}%</td>
                          <td className={getWindClass(range.avgWind)}>
                            {range.avgWind.toFixed(1)} m/s
                          </td>
                          <td className={styles.windDirection}>
                            {getWindDirection(range.normalizedWindDir)}
                          </td>
                          <td>{range.maxRain.toFixed(1)} mm</td>
                          <td className={styles.weatherDescription}>
                            {getWeatherDescription(range.dominantWeatherCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.clothesRecommendation}>
                  {suggestClothes(
                    day.ranges[0].avgTemp,
                    Math.max(...day.ranges.map(r => r.avgWind)),
                    day.ranges.some(r => r.willRain),
                    day.ranges[0].normalizedWindDir
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Aplikacja Pogodowa dla Rowerzystów © 2025</p>
      </footer>
    </div>
  );
}
