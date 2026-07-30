import React from 'react'
import { IframeAwareShell } from './Components/IframeAwareShell'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <IframeAwareShell>{children}</IframeAwareShell>
    )
}

export default layout
