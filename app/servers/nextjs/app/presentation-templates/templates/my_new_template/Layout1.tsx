import React from 'react';

interface LayoutProps {
    data?: any;
}

const Layout1: React.FC<LayoutProps> = ({ data }) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <h1 className="text-4xl font-bold mb-4">
                {data?.title || "Your Title Here"}
            </h1>
            <p className="text-xl text-center">
                {data?.description || "Add your description here"}
            </p>
        </div>
    );
};

export default Layout1;
