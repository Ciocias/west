// cache object to store remote calls output
var cache = { packages: undefined };

function toggle_visibility (id, status)
{
  let element = document.getElementById(id);

  if (!element)
    return;

  // if given, set new display value
  if (status) {
    element.style.display = status;
    return;
  }

  // if not, flip current value between block and none
  if (!(element.style.display) || element.style.display === 'none')
    element.style.display = 'block';
  else if (element.style.display === 'block' || element.style.display === 'inline-block')
    element.style.display = 'none';
}

// Check if form input is valid. If it is, try to connect to ros
function validate (form)
{
  let conn_data = {};

  for (let i = 0; i < form.elements.length; i++)
  {
    if (form.elements[i].name && form.elements[i].value)
      conn_data[form.elements[i].name] = form.elements[i].value;
  }

  if (conn_data.address && conn_data.port)
  {
    update_header(conn_data.address, conn_data.port);
    connect_to_ros(conn_data);
  }
}

// TODO: docstring
function call_service (ros, name, type, params, success_cb, error_cb)
{
  let srv = new ROSLIB.Service({
    ros: ros,
    name: name,
    serviceType: type
  });

  let request = new ROSLIB.ServiceRequest(params);

  srv.callService(request, success_cb, error_cb);
}

// TODO: call service from west backend
function launch_node (event)
{
  console.log('launching ' + event.target.innerHTML + ' ...');
}

function update_header (address, port)
{
  let header = document.getElementsByTagName('header')[0];

  // set title and some info about remote host
  header.innerHTML = '<h2>west</h2>'
  header.innerHTML += '<p>connected to <b>' + address +
                     '</b> on port <b>' + port + '</b></p>';

  // hide connection form
  toggle_visibility('connection', 'none');
}

function update_nodes_sublist (curr, parent)
{
  // don't create sublists if no nodes are available
  if (cache.packages[curr].nodes[0] === "")
    return;

  // build sublist from cache
  let id = cache.packages[curr].name + '_nodes';
  let sub = document.createElement('ul');

  // set sublist id for later retrieval
  sub.id = id;
  sub.style.display = 'inline-block';

  for (let j = 0; j < cache.packages[curr].nodes.length; j++)
  {
    let sub_el = document.createElement('li');
    let h5 = document.createElement('h5');

    h5.innerHTML = cache.packages[curr].nodes[j];
    // for each element set onclick as launch_node something
    h5.addEventListener('click', launch_node);

    sub_el.appendChild(h5);
    sub.appendChild(sub_el);
  }

  // append sublist to first level list
  parent.appendChild(sub);
}

function update_available_packages (ros)
{
  if (cache && cache.packages !== undefined)
  {
    for (let i = 0; i < cache.packages.length; i++)
    {
      let li = document.createElement('li');
      let h4 = document.createElement('h4');

      h4.innerHTML = cache.packages[i].name;

      h4.addEventListener('click', function (event) {
        let parent = event.target.parentNode;

        if (cache.packages[i].nodes !== undefined) {
          toggle_visibility(cache.packages[i].name + '_nodes');
        }
        else
        {
          // get nodes list for current package
          call_service(ros,
            '/node_list', 'west_tools/NodeList',
            { pack: cache.packages[i].name },
            function (result) {
              cache.packages[i].nodes = [];
              for (let j = 0; j < result.node_list.length; j++) {
                cache.packages[i].nodes.push(result.node_list[j]);
              }
              // trigger list view update
              if (result.node_list.length >= 1 && result.node_list[0] !== '')
                update_nodes_sublist(i, parent);
            },
            function (error) {
              console.log('node_list:  ' + error);
            }
          );
        }
      });

      li.appendChild(h4);
      document.getElementById('packages').children[0].appendChild(li);
    }
  }
}

function connect_to_ros (data)
{
  var ros = new ROSLIB.Ros({
    url: 'ws://' + data.address + ':' + data.port
  });

  ros.on('error', (error) => {
    console.log('connection error: ', error);
  }); // on error

  ros.on('close', () => {
    console.log('connection closed');
  }); // on close

  ros.on('connection', () => {
    // show controls on connection
    toggle_visibility('controls', 'block');

    // get available packages if not already stored in cache
    if (cache.packages === undefined)
    {
      call_service(
        ros, '/pack_list', 'west_tools/PackList', {},
        function (result) {
          cache.packages = [];
          for (let i = 0; i < result.pack_list.length; i++)
          {
            cache.packages.push({
              name: result.pack_list[i],
              nodes: undefined
            });
          }
          // manually trigger packages list view update
          if (result.pack_list.length >= 1 && result.pack_list[0] !== ''
            )
            update_available_packages(ros);
        },
        function (error) {
          console.log('pack_list:  ' + error);
        }
      );
    }

    // setup subscription for rosout
    let rosout = new ROSLIB.Topic({
      ros: ros,
      name: '/rosout',
      messageType: 'rosgraph_msgs/Log'
    });
    rosout.subscribe(function (message)
    {
      // create a new subscription entry
      let li = document.createElement('li');

      // left: topic name
      li.innerHTML = '<span style="float: left;"><b>/rosout</b>:</span>';
      // right: message
      li.innerHTML += '</span style="float: right;">' + message.msg + '</span>';

      // append to list (first child of logs section)
      document.getElementById('logs').children[0].appendChild(li);
    });

    // get all running nodes on remote host
    ros.getNodes((data) => {
      let list = document.getElementById('running').children[0];

      for (let i = 0; i < data.length; i++)
      {
        let li = document.createElement('li');

        li.innerHTML = '<h4>' + data[i] + '</h4>';
        li.setAttribute('node_name', data[i]);

        list.appendChild(li);
      }
    });
  }); // on connection
}

window.onload = function ()
{
  // setup initial page state
  toggle_visibility('connection', 'block');
  toggle_visibility('controls', 'none');
  toggle_visibility('running', 'none');
  toggle_visibility('logs', 'none');
  toggle_visibility('packages', 'none');
}
