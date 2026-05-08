import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className='flex h-screen overflow-hidden bg-[#fbf9ff] text-slate-950'>
            <DashboardSidebar />
            <div className='h-screen flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)]'>
                {children}
            </div>
        </div>
    )
}

export default layout
