function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function setupEditorAutoUpdate(editor, profile, column) {
    editor.on("change", debounce(async function () {
        const content = editor.getValue();

        try {
            const response = await fetch(`${CONFIG.BACKEND_ENDPOINT}/shacl-update/${profile}/${column}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: content
            });

            if (response.ok) {
                console.log(`Successfully updated ${profile} ${column}; attempting to update the results...`);
                const columns_to_update = ['sparql', 'results'];
                for (const col of columns_to_update) {
                    const targetEditor = editorsMap[profile].find(e => e.getTextArea().id === `${profile}_${col}`);
                    if (targetEditor) {
                        await updateEditorWithData(profile, col, targetEditor);
                    }
                }
            } else {
                console.error(`Failed to update ${profile} ${column}. Status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error updating ${profile} ${column}`, error);
        }
    }, 250)); // The function will be executed 250 ms after the last change event
}

async function updateEditorWithData(profile, column, editor) {
    try {
        const responseData = await fetch(`${CONFIG.BACKEND_ENDPOINT}/shacl-profiles/${profile}/${column}`, {mode: 'cors'});
        const data = await responseData.text();

        editor.setValue(data);

        setTimeout(function () {
            editor.refresh();
        }, 1);
    } catch (error) {
        console.error("Error updating editor with data: ", error);
    }
}


let editorsMap = {};

async function fetchProfiles() {
    const response = await fetch(`${CONFIG.BACKEND_ENDPOINT}/shacl-profiles`);
    return response.json();
}

function createTab(profile, isActive) {
    const tabButton = document.createElement('a');
    tabButton.href = `#${profile}_tab`;
    tabButton.innerText = profile;

    const tabListItem = document.createElement('li');
    tabListItem.className = `tab col s3${isActive ? ' active' : ''}`;
    tabListItem.appendChild(tabButton);

    return tabListItem;
}

function createEditor(column, profile) {
    // Creating the editor div with a title
    const editorDiv = document.createElement('div');
    editorDiv.className = `${column}-editor`; // Assign a class for styling

    const editorTitle = document.createElement('h5');
    editorTitle.innerText = column.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    editorDiv.appendChild(editorTitle);

    const textArea = document.createElement('textarea');
    textArea.id = `${profile}_${column}`;
    editorDiv.appendChild(textArea);

    const editorMode = column === 'runtime_values' ? 'application/json' : (column === 'sparql' ? 'sparql' : 'turtle');
    const isReadOnly = column === 'sparql';

    const editor = CodeMirror.fromTextArea(textArea, {
        mode: editorMode,
        lineWrapping: true,
        readOnly: isReadOnly,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], // Include the foldgutter
        foldGutter: true, // Enable the foldGutter
        foldOptions: {
            rangeFinder: new CodeMirror.fold.combine(CodeMirror.fold.prefix), // Setup using the "prefix" fold function
            widget: "..."
        },
        autoRefresh: true
    });

    return {editor, editorDiv};
}


async function populateProfiles() {
    try {
        const profileNames = await fetchProfiles();

        const profilesTabList = document.createElement('ul');
        profilesTabList.className = 'tabs';

        const profileContainer = document.getElementById('tableRows');
        profileContainer.appendChild(profilesTabList);

        for (let i = 0; i < profileNames.length; i++) {
            const profile = profileNames[i];
            const isActive = i === 0;

            profilesTabList.appendChild(createTab(profile, isActive));

            const profileTabPane = document.createElement('div');
            profileTabPane.id = `${profile}_tab`;
            profileTabPane.className = `col s12 tab-content-pane ${isActive ? 'active' : ''}`;

            const columns = ['runtime_values', 'endpoint_definition', 'profile', 'sparql', 'example_data', 'results'];
            let topRow = document.createElement('div');
            topRow.className = 'row';

            let bottomRow = document.createElement('div');
            bottomRow.className = 'row';

            // Hardcoding the creation of the nested top left cell
            const topLeftColumn = document.createElement('div');
            topLeftColumn.className = 'col s6 top-left-column';

            const endpointDefRow = document.createElement('div');
            endpointDefRow.className = 'row endpoint_definition-row';
            const runtimeValesRow = document.createElement('div');
            runtimeValesRow.className = 'row';

            topLeftColumn.appendChild(runtimeValesRow);
            topLeftColumn.appendChild(endpointDefRow);
            topRow.appendChild(topLeftColumn);

            for (const column of columns) {
                const {editor, editorDiv} = createEditor(column, profile);
                await updateEditorWithData(profile, column, editor);
                if (!editorsMap[profile]) {
                    editorsMap[profile] = [];
                }
                editorsMap[profile].push(editor);

                if (column === 'endpoint_definition') {
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col s12'; // Taking the full width of its container
                    columnDiv.appendChild(editorDiv);
                    endpointDefRow.appendChild(columnDiv);
                } else if (column === 'runtime_values') {
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col s12'; // Taking the full width of its container
                    columnDiv.appendChild(editorDiv);
                    runtimeValesRow.appendChild(columnDiv);
                } else if (['sparql', 'profile'].includes(column)) {
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col s6';
                    columnDiv.appendChild(editorDiv);
                    topRow.appendChild(columnDiv);
                } else { // For 'example_data' and 'results'
                    const columnDiv = document.createElement('div');
                    columnDiv.className = 'col s6';
                    columnDiv.appendChild(editorDiv);
                    bottomRow.appendChild(columnDiv);
                }

                if (['endpoint_definition', 'profile', 'example_data', 'runtime_values'].includes(column)) {
                    setupEditorAutoUpdate(editor, profile, column);
                }
            }

            profileTabPane.appendChild(topRow);
            profileTabPane.appendChild(bottomRow);

            profileTabPane.appendChild(topRow);
            profileTabPane.appendChild(bottomRow);
            profileContainer.appendChild(profileTabPane);
        }

    } catch (error) {
        console.error("Error populating profiles: ", error);
    }
}


document.addEventListener('DOMContentLoaded', async function () {
    await populateProfiles();
    // Initialize the tabs
    setTimeout(() => {
        const elems = document.querySelectorAll('.tabs');
        M.Tabs.init(elems);
    }, 0);
});
