import React, { useState } from 'react';
import { GoogleMap, useLoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '50vw',
  height: '80vh',
};

const initialCenter = {
  lat: 36.980375, // Santa Cruz Area
  lng: -122.051286,
};

function App() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: 'AIzaSyCAywyEZQ9trE9VsQkkC1rJB9lwYHwpZOU', 
  });

  const [center, setCenter] = useState(initialCenter);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [markers, setMarkers] = useState([]); 
  const [drivingDirections, setDrivingDirections] = useState(null); 
  const [bicyclingDirections, setBicyclingDirections] = useState(null); 
  const [drivingDistance, setDrivingDistance] = useState(''); 
  const [drivingDuration, setDrivingDuration] = useState(''); 
  const [bicyclingDistance, setBicyclingDistance] = useState(''); 
  const [bicyclingDuration, setBicyclingDuration] = useState(''); 
  const [carbonEmissions, setCarbonEmissions] = useState(null); 
  const [transitEmissions, setTransitEmissions] = useState(null);

  const KM_TO_MILES = 0.621371;

  const handleSubmit = (e) => {
    e.preventDefault();
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
      setCenter({ lat, lng });
      setMarkers((currentMarkers) => [...currentMarkers, { lat, lng }]);
    } else {
      alert('Please enter valid coordinates.');
    }
  };

  if (!isLoaded) return <div>Loading Maps...</div>;

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCenter({ lat: latitude, lng: longitude });
        setMarkers((currentMarkers) => [...currentMarkers, { lat: latitude, lng: longitude }]);
      }, () => {
        alert('Unable to retrieve your location.');
      });
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const calculateRoute = () => {
    if (markers.length >= 2) {
      const origin = markers[0];
      const destination = markers[markers.length - 1];

      const directionsService = new window.google.maps.DirectionsService();

      // Calculate driving route
      directionsService.route(
        {
          origin,
          destination,
          travelMode: 'DRIVING',
        },
        (result, status) => {
          if (status === 'OK') {
            setDrivingDirections(result);
            const route = result.routes[0].legs[0];
            const drivingDurationInMinutes = convertDurationToMinutes(route.duration.text);
            setDrivingDistance(route.distance.text); 
            setDrivingDuration(drivingDurationInMinutes);

            // Call Climatiq API with the driving distance in km
            const distanceKm = parseFloat(route.distance.text.split(' ')[0]) * (1 / KM_TO_MILES);
            fetchCarbonEmissions(distanceKm); // Fetch carbon emissions
          } else {
            console.error(`Error fetching driving directions: ${result}`);
          }
        }
      );

      // Calculate bicycling route
      directionsService.route(
        {
          origin,
          destination,
          travelMode: 'BICYCLING',
        },
        (result, status) => {
          if (status === 'OK') {
            setBicyclingDirections(result);
            const route = result.routes[0].legs[0];
            const bicyclingDurationInMinutes = convertDurationToMinutes(route.duration.text);
            setBicyclingDistance(route.distance.text); 
            setBicyclingDuration(bicyclingDurationInMinutes);
          } else {
            console.error(`Error fetching bicycling directions: ${result}`);
          }
        }
      );

      // Calculate transit route (public transportation)
      directionsService.route(
        {
          origin,
          destination,
          travelMode: 'TRANSIT',
        },
        (result, status) => {
          if (status === 'OK') {
            const route = result.routes[0].legs[0];
            const transitDistanceInKm = parseFloat(route.distance.text.split(' ')[0]) * (1 / KM_TO_MILES);
            
            // Bus emission factor: 0.089 kg CO2 per passenger per kilometer
            const busEmissionFactor = 0.089; 
            const emissions = transitDistanceInKm * busEmissionFactor;

            setTransitEmissions(emissions.toFixed(2)); // Store calculated transit emissions
          } else {
            console.error(`Error getting transit directions: ${result}`);
          }
        }
      );
    } else {
      alert('Please enter both starting and destination points.');
    }
  };


  const fetchCarbonEmissions = async (distanceKm) => {
    const api_key = "3TQJ4AM7FS6SXCYDF2XX5MCW5C";
    const url = "https://api.climatiq.io/data/v1/estimate";

    const payload = {
      emission_factor: {
        activity_id: "passenger_vehicle-vehicle_type_car-fuel_source_bio_petrol-distance_na-engine_size_medium",
        data_version: "^6"
      },
      parameters: {
        distance: distanceKm,
        distance_unit: "km"
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setCarbonEmissions({
          co2e: data.co2e,
          unit: data.co2e_unit,
        });
      } 

    } catch (error) {
      console.error('Error:', error);
      setCarbonEmissions(null);
    }
  };

  // convert to minutes
  const convertDurationToMinutes = (durationText) => {
    let totalMinutes = 0;
    const hoursMatch = durationText.match(/(\d+)\s*hour/);
    const minutesMatch = durationText.match(/(\d+)\s*min/);

    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    }
    if (minutesMatch) {
      totalMinutes += parseInt(minutesMatch[1], 10);
    }

    return totalMinutes;
  };

  return (
    <div>
      <h2 id='heading'>Help Reduce Carbon</h2>

      <div className="main-container">
        <div className="map-container">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={10}
            center={center}
          >
            {markers.map((marker, index) => (
              <Marker key={index} position={marker} />
            ))}

            {drivingDirections && (
              <DirectionsRenderer
                directions={drivingDirections}
                options={{ polylineOptions: { strokeColor: 'orange' } }}
              />
            )}

            {bicyclingDirections && (
              <DirectionsRenderer
                directions={bicyclingDirections}
                options={{ polylineOptions: { strokeColor: 'blue' } }}
              />
            )}
          </GoogleMap>
        </div>

        <div className="location-input">
          <h2>First Find Your Location</h2>
          <button id='findmy' onClick={handleGetCurrentLocation}>Find My Location</button>

          <h2>Next Input Where You're Going</h2>
          <form onSubmit={handleSubmit}>
            <div>
              <label>Latitude:</label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Enter latitude"
              />
            </div>

            <div>
              <label>Longitude:</label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Enter longitude"
              />
            </div>

            <button type="submit">Mark your location</button>
          </form>

          <div>
            <h3>Click the button below to see how you can reduce your carbon emission</h3>
            <button onClick={calculateRoute}>Show Both Routes</button>
          </div>

          <div id="route-info">
            <p>Click the button above again to see the different routes OR input new coordinates.</p>
            <hr />
            <h4>Results:</h4>
            {drivingDistance && drivingDuration && (
              <p style={{ color: 'orange' }}>Driving Route (Orange): {drivingDistance} | Estimated Time: {drivingDuration} minutes</p>
            )}
            {bicyclingDistance && bicyclingDuration && (
              <p style={{ color: 'blue' }}>Bicycling Route (Blue): {bicyclingDistance} | Estimated Time: {bicyclingDuration} minutes</p>
            )}
            <hr />
            <h4>How You Can Reduce your Carbon Emissions</h4>

            <div>
              {bicyclingDuration && drivingDuration && bicyclingDuration < drivingDuration && (
                <>
                  <p>Given that the route is approximately {bicyclingDistance}, riding by bike or walking/running is an effective way to reduce your carbon emissions.</p>
                  <p>Riding by bicycle may also be faster than traveling by car by {drivingDuration - bicyclingDuration} minutes.</p>
                </>
              )}

              {bicyclingDuration !== '' && (
                bicyclingDuration > 30 ? (
                  <>
                    <p>We understand that bicycling oftentimes may be hard if your destination is too far. In this case, to reduce your carbon emissions, we suggest taking a bus or utilizing an electronic vehicle.</p>
                    <p style={{ color: 'lightgreen' }}>
                    <strong>
                      Estimated CO2 emissions from taking the public transit buses vs driving: {((parseFloat(carbonEmissions?.co2e) || 0) - (parseFloat(transitEmissions) || 0)).toFixed(2)} kg CO2
                    </strong>
                  </p>

                  </>
                ) : (
                  <p><strong>Our Final Suggestion: </strong>We highly suggest bicycling or walking/jogging as the best way to reduce your carbon emissions.</p>
                )
              )}

              {carbonEmissions && (
                <p style={{ color: 'lightgreen' }}><strong>Estimated CO2 emissions reduced by not driving: {carbonEmissions.co2e} {carbonEmissions.unit}</strong></p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;
