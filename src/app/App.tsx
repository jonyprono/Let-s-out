import { useState } from 'react';
import { Splashscreen } from './components/Splashscreen';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Onboarding } from './components/Onboarding';
import { Home } from './components/Home';
import { Explorer } from './components/Explorer';
import { EventDetails } from './components/EventDetails';
import { CreateEvent } from './components/CreateEvent';
import { Messages } from './components/Messages';
import { Notifications } from './components/Notifications';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string>('splash');
  const [userData, setUserData] = useState<any>(null);

  return (
    <div className="size-full bg-white overflow-hidden">
      {/* Mobile Frame Container */}
      <div className="w-full h-full max-w-[430px] mx-auto bg-white relative">
        {currentScreen === 'splash' && <Splashscreen onComplete={() => setCurrentScreen('login')} />}
        {currentScreen === 'login' && (
          <Login
            onLogin={() => setCurrentScreen('home')}
            onSignup={() => setCurrentScreen('signup')}
          />
        )}
        {currentScreen === 'signup' && (
          <Signup
            onComplete={() => setCurrentScreen('onboarding')}
            onBack={() => setCurrentScreen('login')}
          />
        )}
        {currentScreen === 'onboarding' && (
          <Onboarding
            onComplete={(data) => {
              setUserData(data);
              setCurrentScreen('home');
            }}
          />
        )}
        {currentScreen === 'home' && (
          <Home
            userData={userData}
            onNavigate={(screen) => setCurrentScreen(screen)}
          />
        )}
        {currentScreen === 'explorer' && (
          <Explorer onNavigate={(screen) => setCurrentScreen(screen)} />
        )}
        {currentScreen === 'event-details' && (
          <EventDetails onBack={() => setCurrentScreen('home')} />
        )}
        {currentScreen === 'create-event' && (
          <CreateEvent onBack={() => setCurrentScreen('home')} />
        )}
        {currentScreen === 'messages' && (
          <Messages onNavigate={(screen) => setCurrentScreen(screen)} />
        )}
        {currentScreen === 'notifications' && (
          <Notifications onBack={() => setCurrentScreen('home')} />
        )}
        {currentScreen === 'profile' && (
          <Profile onNavigate={(screen) => setCurrentScreen(screen)} />
        )}
        {currentScreen === 'settings' && (
          <Settings onBack={() => setCurrentScreen('profile')} />
        )}
      </div>
    </div>
  );
}
