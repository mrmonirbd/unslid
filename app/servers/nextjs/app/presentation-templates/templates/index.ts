import Layout1 from './my_new_template/Layout1';
import Layout2 from './my_new_template/Layout2';

export const myNewTemplate = {
    id: 'my-new-template',
    name: 'My New Template',
    description: 'A beautiful custom template',
    category: 'Business',
    layouts: [
        {
            id: 'layout-1',
            name: 'Title Slide',
            component: Layout1,
            sampleData: {
                title: 'Sample Title',
                description: 'This is a sample description for preview'
            }
        },
        {
            id: 'layout-2',
            name: 'Three Points',
            component: Layout2,
            sampleData: {
                point1: 'First important point',
                point2: 'Second important point',
                point3: 'Third important point'
            }
        }
    ]
};
