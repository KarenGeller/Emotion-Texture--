/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { OpeningView } from './components/OpeningView';
import { WorkspaceView } from './components/WorkspaceView';
import { Emotion } from './types';

export default function App() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  return (
    <div className="min-h-screen bg-[#020206] text-white">
      {selectedEmotion ? (
        <WorkspaceView
          emotion={selectedEmotion}
          onBack={() => setSelectedEmotion(null)}
        />
      ) : (
        <OpeningView onSelectEmotion={setSelectedEmotion} />
      )}
    </div>
  );
}

