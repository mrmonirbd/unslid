cat > Layout2.tsx << 'EOF'
import React from 'react';

interface LayoutProps {
    data?: any;
}

const Layout2: React.FC<LayoutProps> = ({ data }) => {
    return (
        <div className="w-full h-full flex flex-col p-8 bg-white">
            <div className="flex gap-4">
                <div className="w-1/3 bg-gray-100 rounded-lg p-4">
                    <h3 className="font-bold">Key Point 1</h3>
                    <p className="text-sm text-gray-600">{data?.point1 || "Your first point"}</p>
                </div>
                <div className="w-1/3 bg-gray-100 rounded-lg p-4">
                    <h3 className="font-bold">Key Point 2</h3>
                    <p className="text-sm text-gray-600">{data?.point2 || "Your second point"}</p>
                </div>
                <div className="w-1/3 bg-gray-100 rounded-lg p-4">
                    <h3 className="font-bold">Key Point 3</h3>
                    <p className="text-sm text-gray-600">{data?.point3 || "Your third point"}</p>
                </div>
            </div>
        </div>
    );
};

export default Layout2;
EOF