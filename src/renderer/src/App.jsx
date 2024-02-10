import React, { useState } from 'react'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [albums, setAlbums] = useState([])
  const [userData, setUserData] = useState(null)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [directory, setDirectory] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  React.useEffect(() => {
    window.electron.ipcRenderer.on('upload-status', (_, message) => {
      setIsUploading(true)
      setUploadStatus(message) // Display the name of the file being uploaded
    })

    window.electron.ipcRenderer.on('upload-complete', (_, message) => {
      setIsUploading(false)
      setUploadStatus(message) // Show completion message
    })

    return () => {
      window.electron.ipcRenderer.removeAllListeners('upload-status')
      window.electron.ipcRenderer.removeAllListeners('upload-complete')
    }
  }, [])

  const handleLogin = (event) => {
    event.preventDefault()
    window.electron.ipcRenderer.send('login', { username, password })

    window.electron.ipcRenderer.once('login-response', (event, response) => {
      if (response.success) {
        console.log(response.message)
        setAlbums(response.albums)
        setUserData(response.user)
      } else {
        console.error(response.message)
        // Handle login failure, e.g., showing an error message
      }
    })
  }

  function logout() {
    setUserData(null)
    setAlbums([])
    // Clear the user data and albums from the state
    //force reload the app
    window.location.reload()
  }

  //if the user is logged in, show the albums
  if (albums.length > 0) {
    return (
      <div className="flex flex-col w-full gap-2 h-full p-4">
        {userData && (
          <div className="navbar absolute top-0 left-0 bg-base-100">
            <div className="flex-1">
              <a className="btn btn-ghost text-xl">{userData.name}</a>
            </div>
            <div className="flex-none gap-2">
              <div className="form-control">
                <input
                  type="text"
                  placeholder="Search Album"
                  className="input input-bordered w-24 md:w-auto"
                />
              </div>
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                  <div className="w-10 rounded-full">
                    <img alt="User Avatar" src="" />
                  </div>
                </div>
                <ul
                  tabIndex={0}
                  className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
                >
                  <li>
                    <a className="justify-between">
                      Profile
                      <span className="badge">New</span>
                    </a>
                  </li>
                  <li>
                    <a>Settings</a>
                  </li>
                  <li>
                    {/*Delete the userdata and albums from the state*/}
                    <a className={'btn btn-sm btn-error'} onClick={
                      () => logout()
                    }>Logout</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
        {albums.length > 0 && (
          <div className={'py-6'}>
            {directory ? (
              <div className={'flex mt-8 items-center justify-center gap-2'}>
                <span className="loading text-center text-warning loading-ring loading-lg"></span>
                <div className={'flex flex-col gap-1'}>
                  <span className={'text-center text-[10px]'}>
                    Monitoring <span className={'font-semibold'}>{directory}</span> for changes
                  </span>
                  <span>
                    Files will be uploaded to{' '}
                    <span className={'font-semibold'}>
                      {albums.find((album) => album.id === selectedAlbum)?.title}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className={'flex mt-8 items-center justify-center gap-2'}>
                <span className="loading text-center text-error loading-spinner loading-lg"></span>
                No directory selected
              </div>
            )}

            {isUploading ? (
              <>
                <progress className="progress my-4 w-full"></progress>
                <p className={'text-sm w-full'}>{uploadStatus}</p>
              </>
            ) : (
              <form className={'flex flex-col gap-2 mb-6'}>
                <h2 className={'my-2'}>
                  Select a folder and click the upload to connect to the server
                </h2>

                <div className={'flex w-full gap-2'}>
                  <div className="flex flex-col  gap-2">
                    <label className={'text-sm'}>Enter the directory path</label>
                    <input
                      className={'input input-sm file-input-sm mr-4'}
                      type="text"
                      value={directory}
                      onChange={(e) => setDirectory(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {/*Drop down to select the album*/}
                    <label className={'text-sm'}>Select Album</label>

                    <select
                      className={'select select-bordered select-sm'}
                      onChange={(e) => setSelectedAlbum(e.target.value)}
                    >
                      <option value={''}>Select Album</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  className={'btn btn-primary btn-sm max-w-[100px] rounded-md mt-4 btn-outline'}
                  onClick={(e) => {
                    e.preventDefault() // Prevent the default form submission behavior
                    setIsUploading(true) // Start uploading
                    window.electron.ipcRenderer.send('upload', {
                      directory,
                      albumId: selectedAlbum,
                      userId: userData.id
                    })
                  }}
                >
                  Upload
                </button>
              </form>
            )}

            <h2 className="text-2xl mb-4 text-center font-bold">My Albums</h2>
            <div className="grid gap-4 grid-cols-2 w-[400px]">
              {albums.map((album) => (
                <section
                  key={album.id}
                  className="flex card ring items-center justify-between p-2 rounded-md border-gray-200 h-40 w-full"
                >
                  <span className={'text-xl font-semibold'}>{album.title}</span>
                  <div className="flex gap-2 w-full flex-col">
                    <span className={'text-sm'}>{album.description}</span>
                    <span>{album.event_date}</span>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl mb-4 font-bold">Login</h1>
      <form className="flex flex-col w-full max-w-sm gap-2" onSubmit={handleLogin}>
        <div className="relative">
          <input
            id="username"
            type="text"
            className={
              'input input-sm ring-1 input-ghost pl-10 border-0 border-none bg-gray-100 rounded-sm text-gray-800 mt-1 w-full'
            }
            placeholder={'Email'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <div className="icon text-gray-400 absolute top-[55%] transform -translate-y-1/2 left-2">
            <i className="fa-regular text-xl fa-envelope"></i>
          </div>
        </div>
        <div className="form-group">
          <input
            id="password"
            type="password"
            className={
              'input input-sm ring-1 input-ghost pl-10 border-0 border-none bg-gray-100 rounded-sm text-gray-800 mt-1 w-full'
            }
            placeholder={'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn normal-case mt-8 btn-sm ring-1 rounded-sm  w-full" type="submit">
          Continue
        </button>
        <div className="text-sm">
          <div className="info text-center mt-8">
            By continuing, you agree to our <br />
            <a href="" className="font-semibold link text-blue-600">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="" className="font-semibold link text-blue-600">
              Privacy Policy
            </a>
          </div>

          <div className="flex mt-10 justify-center items-center">
            New to us? {' '}
            <a href="" className="font-semibold">
              {' '}
              Create an account
            </a>
          </div>
        </div>
      </form>
    </>
  )
}

export default App
