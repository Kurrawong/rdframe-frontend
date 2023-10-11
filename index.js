function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function setupEditorAutoUpdate(editor, profile, column) {
    editor.on("change", debounce(async function() {
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
        const responseData = await fetch(`${CONFIG.BACKEND_ENDPOINT}/shacl-profiles/${profile}/${column}`, { mode: 'cors' });
        const data = await responseData.text();

        editor.setValue(data);

        setTimeout(function() {
            editor.refresh();
        }, 1);
    } catch (error) {
        console.error("Error updating editor with data: ", error);
    }
}


let editorsMap = {};

async function populateProfiles() {
    try {
        const response = await fetch(`${CONFIG.BACKEND_ENDPOINT}/shacl-profiles`);
        const profileNames = await response.json();

        const profilesTabList = document.createElement('ul');
        profilesTabList.className = 'tabs';

        const profileContainer = document.getElementById('tableRows');
        profileContainer.appendChild(profilesTabList);

        for (let i = 0; i < profileNames.length; i++) {
            const profile = profileNames[i];
            const isActive = i === 0;

            const tabButton = document.createElement('a');
            tabButton.href = `#${profile}_tab`;
            tabButton.innerText = profile;

            const tabListItem = document.createElement('li');
            tabListItem.className = `tab col s3${isActive ? ' active' : ''}`;
            tabListItem.appendChild(tabButton);
            profilesTabList.appendChild(tabListItem);

            const profileTabPane = document.createElement('div');
            profileTabPane.id = `${profile}_tab`;
            profileTabPane.className = `col s12 tab-content-pane ${isActive ? 'active' : ''}`;

            const columns = ['profile', 'sparql', 'example_data', 'results'];
            let topRow = document.createElement('div');
            topRow.className = 'row';
            let bottomRow = document.createElement('div');
            bottomRow.className = 'row';

            for (const column of columns) {
                const columnDiv = document.createElement('div');
                columnDiv.className = 'col s6';

                const title = document.createElement('h3');
                title.innerText = column.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                columnDiv.appendChild(title);

                const textArea = document.createElement('textarea');
                textArea.id = `${profile}_${column}`;
                columnDiv.appendChild(textArea);

                const editorMode = column === 'sparql' ? 'sparql' : 'turtle';
                const isReadOnly = column === 'sparql';

                const editor = CodeMirror.fromTextArea(textArea, {
                    mode: editorMode,
                    lineWrapping: true,
                    readOnly: isReadOnly,
                    foldOptions: {
                        rangeFinder: CodeMirror.fold.prefix,
                        widget: "..."
                    },
                    autoRefresh: true
                });

                if (!editorsMap[profile]) {
                    editorsMap[profile] = [];
                }
                editorsMap[profile].push(editor);

                await updateEditorWithData(profile, column, editor);

                if (['profile', 'sparql'].includes(column)) {
                    setupEditorAutoUpdate(editor, profile, column);
                    topRow.appendChild(columnDiv);
                } else {
                    bottomRow.appendChild(columnDiv);
                }
            }

            profileTabPane.appendChild(topRow);
            profileTabPane.appendChild(bottomRow);
            profileContainer.appendChild(profileTabPane);
        }

    } catch (error) {
        console.error("Error populating profiles: ", error);
    }
}


document.addEventListener('DOMContentLoaded',async function() {
    await populateProfiles();
    // Initialize the tabs
    setTimeout(() => {
        const elems = document.querySelectorAll('.tabs');
        M.Tabs.init(elems);
    }, 0);
});
