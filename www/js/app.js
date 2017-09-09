// cache object to store remote calls output
var cache = { ros_call: undefined, packages: undefined, nodes: undefined };

/* ------------------------------
  - Set or toggle visibility to the tag identified by id
  ------------------------------ */
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

/* ------------------------------
  - Without params the section with id as 'running', 'logs' and 'packages'
  are hidden, and each controls button are unselected
  (with class 'w3-cyan' is consider selected)
  - With @id set on 'block' the display value to tag identified by id
  - With @button set button as selected
  ------------------------------ */
function switch_controls(id, button)
{
  toggle_visibility('running', 'none');
  toggle_visibility('logs', 'none');
  toggle_visibility('packages', 'none');
  
  controls = document.getElementById('controls').children;
  for (let i = 0; i < controls.length; i++)
  {
    controls[i].classList.remove('w3-cyan');
  }
  
  // With @id
  if(id)
  {
    toggle_visibility(id, 'block');
  }

  // With @button
  if (button)
  {
    button.classList.add('w3-cyan');
  }
}

/* ------------------------------
  - Hide all section except control and update list of available packages and running nodes
  ------------------------------ */
function refresh_page (timeout)
{
  // animate refresh button 
  refresh = document.getElementById('refresh');
  refresh.setAttribute('class', 'glyphicon glyphicon-refresh w3-xlarge w3-spin');

  switch_controls('controls');
  toggle_visibility('back_service', 'none');
  setTimeout(() => {

    cache.packages();
    cache.nodes();

    clear_param_section();
    // stop animation
    refresh.setAttribute('class', 'glyphicon glyphicon-refresh w3-xlarge');
  }, timeout);
}

/* ------------------------------
  - Simple snackbar with given message
  ------------------------------ */
function show_snackbar (message)
{
  // get the snackbar div
  snackbar = document.getElementById('snackbar');
  snackbar.innerHTML = message;
  // add the 'show' class to div
  snackbar.className = 'show';
  // after 5 seconds, remove the show class from div
  setTimeout( () => { snackbar.className = ''; }, 5000);
}

// rotate list arrow
function toggle_arrow (arrow, direction, disable)
{
  if (disable)
  {
    arrow.setAttribute('disable', disable);
    arrow.setAttribute('class', 'fa fa-arrow-right w3-large w3-display-topleft');
  }
  if (arrow.getAttribute('disable') === null || arrow.getAttribute('disable') !== 'true')
  {
    if (direction)
    {
      arrow.setAttribute('class', 'fa fa-arrow-' + direction + ' w3-large w3-display-topleft');
    }
    else if(arrow.getAttribute('class') === 'fa fa-arrow-right w3-large w3-display-topleft')
    {
      arrow.setAttribute('class', 'fa fa-arrow-down w3-large w3-display-topleft');
    }
    else
    {
      arrow.setAttribute('class', 'fa fa-arrow-right w3-large w3-display-topleft');
    }
  }
}

// create a simple html header
function build_header (address, port)
{
  let header = document.getElementsByTagName('header')[0];

  // set title and some info about remote host
  header.innerHTML = '<h2>west</h2>'
  header.innerHTML += '<p>connected to <b>' + address +
                     '</b> on port <b>' + port + '</b></p>';

  let refresh = document.getElementById('refresh');
  refresh.addEventListener('click', refresh_page);

  //header.appendChild(refresh);

  // hide connection form
  toggle_visibility('connection', 'none');
}

// Check if form input is valid. If it is, try to connect to ros
function validate_connection (form)
{
  let conn_data = {};

  for (let i = 0; i < form.elements.length; i++)
  {
    if (form.elements[i].name && form.elements[i].value)
      conn_data[form.elements[i].name] = form.elements[i].value;
  }

  if (conn_data.address && conn_data.port)
  {
    build_header(conn_data.address, conn_data.port);
    connect_to_ros(conn_data);
  }
}

// build service call parameters form with request details
function build_param_section (name, details, response)
{
  console.log(response);
  document.getElementById('result').setAttribute('fieldname', response[0]);

  let param_section = document.getElementById('param_section');
  // param_section -> header
  let header = param_section.children[0];

  let form = document.getElementById('param_form');
  // form -> ul
  let ul = form.children[0];

  header.innerHTML = 'Service name : ' + name + '<br>Service type : ' + details.type;

  form.setAttribute('service_name', name);
  form.setAttribute('service_details', details.type);

  for (let i = 0; i < details.fieldnames.length; i++)
  {
    let li = document.createElement('li');
    let h3 = document.createElement('h3');
    let input = document.createElement('input');
    
    h3.innerHTML = details.fieldnames[i];

    input.setAttribute('name', details.fieldnames[i]);
    input.setAttribute('placeholder', details.fieldtypes[i]);
    input.setAttribute('required', true);

    // set correct type for input
    if (details.fieldtypes[i] === 'string')
    {
      input.setAttribute('type', 'text');
    }
    else if (details.fieldtypes[i] === 'bool')
    {
      input.setAttribute('type', 'checkbox');
    }
    else {
      input.setAttribute('type', 'number');
      input.setAttribute('step', 'any');
    }

    li.appendChild(h3);
    li.appendChild(input);
    ul.appendChild(li);
  }

  toggle_visibility('param_section', 'block');
  toggle_visibility('running_list', 'none');
  document.getElementById('back_service').addEventListener('click', () => { clear_param_section(); });
  toggle_visibility('back_service', 'inline-block');
}

// Check if param form input is valid. If it is, try to call relative service
function validate_param_section (form)
{
  // form -> ul
  let ul = document.getElementById('param_form').children[0];
  let param = {};

  // subtract one to form to avoid count last once buttons
  for (let i = 0; i < form.elements.length - 1; i++)
  {
    // if current element is an input tag
    if (isNaN(form.elements[i].value))
      param[form.elements[i].name] = form.elements[i].value;
    else
      param[form.elements[i].name] = Number(form.elements[i].value);
  }

  console.log('param');
  console.log(param);

  // call service
  cache.ros_call(
    form.getAttribute('service_name'),
    form.getAttribute('service_type'),
    param,
    (result) => {
      let div = document.getElementById('result');
      let field = result[div.getAttribute('fieldname')];
      
      let p = document.createElement('p');

      switch (typeof field)
      {
        case 'object':
        {
          for (let i = 0; i < field.length; i++)
          {
            let p = document.createElement('p')
            p.innerHTML = i + ' - [' + field[i].toString() + ']';
            div.appendChild(p);
          }
        } break;

        case 'undefined':
        {
          p.innerHTML = 'undefined';
          div.appendChild(p);
        } break;

        case 'boolean':
        {
          p.innerHTML = 'boolean : ' + field;
          div.appendChild(p);
        } break;

        default:
        {
          p.innerHTML = field.toString();
          div.appendChild(p);
        }
      }

      toggle_visibility('result');
    },
    (error) => {
      show_snackbar('service NOT called!');
      console.log(error);
    }
  );

  // clear service param modal
  form.removeAttribute('servicename');
  form.removeAttribute('servicetype');
  
  toggle_visibility('param_form', 'none');
  toggle_visibility('back_service', 'none');  
}

// cancel service request
function clear_param_section ()
{
  toggle_visibility('param_section', 'none');
  toggle_visibility('result', 'none');
  toggle_visibility('param_form', 'block');
  toggle_visibility('controls', 'block');
  toggle_visibility('back_service', 'none');
  toggle_visibility('running_list', 'block');
  
  // param_section -> header
  document.getElementById('param_form').children[0].innerHTML = '';
  // form -> ul
  document.getElementById('param_section').children[0] = '';
  // result
  document.getElementById('result').innerHTML = '<h2> Result : </h2>';
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

//
function call_service_builder (ros)
{
  return function (name, type, params, success_cb, error_cb)
  {
    let srv = new ROSLIB.Service({
      ros: ros,
      name: name,
      serviceType: type
    });

    let request = new ROSLIB.ServiceRequest(params);

    srv.callService(request, success_cb, error_cb);
  }
}

// TODO: docstring
function launch_node_builder (ros)
{
  return function (event) 
  {
    console.log('launching ' + event.target.innerHTML + ' ...');
    // call service to launch new node
    call_service(
      ros,
      '/run_node',
      '/west_tools/RunNode',
      {
        pack: event.target.parentNode.parentNode.getAttribute('name'),
        node: event.target.innerHTML
      },
      (result) => {
        show_snackbar('node launched successfully');
        console.log(result);
      },
      (error) => {
        show_snackbar('node NOT launched!');
        console.log(error);
      }
    );

    // finally, after one second, refresh app page
    refresh_page(1000);
  }
}

// callback of service click
function launch_service_builder (ros)
{
  return function (event)
  {
    console.log('launching ' + event.target.innerHTML + ' service ...');
    // retrive service type and params by name
    ros.getServiceType(event.target.innerHTML, (type) => {
      ros.getServiceRequestDetails(type, (typeDetails) => {
        ros.getServiceResponseDetails(type, (responseDetails) => {
          clear_param_section();
          toggle_visibility('controls', 'none');
          build_param_section(event.target.innerHTML, typeDetails.typedefs[0], responseDetails.typedefs[0].fieldnames);
        });
      });
    });
  };
}

// create primary list
function update_list (ros, parent, list, listener, kill_listener)
{
  for (let i = 0; i < list.length; i++)
  {
    let li = document.createElement('li');
    let h4 = document.createElement('h4');
    let arrow = document.createElement('i');

    // for each element of list inizialize flag to perform the operation one time
    list[i].executed = false;

    li.setAttribute('class', 'w3-display-container w3-bar w3-hover-cyan');
    h4.innerHTML = list[i].name;
    arrow.setAttribute('class','fa fa-arrow-right w3-large w3-display-topleft');

    h4.addEventListener('click', (event) => {
      toggle_arrow(arrow);
      listener(ros, event.target.parentNode, arrow, list[i]);
    });

    li.appendChild(h4);
    li.appendChild(arrow);
    
    if (kill_listener)
    {
      let kill = document.createElement('i');
      //kill.innerHTML = '&times';
      kill.setAttribute('class', 'fa fa-close w3-large w3-display-topright');
      kill.addEventListener('click', (event) => {
        kill_listener(ros, event.target.parentNode, list[i]);
      });
      li.appendChild(kill);
    }
    parent.appendChild(li);
  }
}

// create drop down list
function update_sublist (curr, parent, name, id, arrow, listener)
{
  // don't create sublists if no nodes are available
  if (curr[0] === "") return;

  // build sublist from cache
  let sub = document.createElement('ul');
    // append sublist to first level list
  parent.appendChild(sub);
  sub.id = id;
  sub.setAttribute('name', name);
  sub.setAttribute('class','w3-ul w3-card-4');
  sub.style.display = 'block';
  toggle_arrow(arrow, 'down');

  for (let i = 0; i < curr.length; i++)
  {
    let sub_el = document.createElement('li');

    sub_el.setAttribute('class', 'w3-bar w3-hover-white');
    let h6 = document.createElement('h6');

    h6.innerHTML = curr[i];
    // for each element set onclick event
    h6.addEventListener('click', listener);
    sub_el.appendChild(h6);
    sub.appendChild(sub_el);
  }
  // append sublist to first level list
  //parent.appendChild(sub);
}

// fill cache with available packages
function update_available_packages_builder (ros)
{
  return function () {
    //
    packages = undefined;
    document.getElementById('packages').children[0].innerHTML = '';
  
    call_service(
        ros, '/pack_list', 'west_tools/PackList', {},
        (result) =>{
          packages = [];
          for (let i = 0; i < result.pack_list.length; i++)
          {
            packages.push(
            {
              name: result.pack_list[i],
              nodes: undefined
            });
          }
          // manually trigger packages list view update
          if (result.pack_list.length >= 1 && result.pack_list[0] !== '')
          {
            update_list(
              ros,
              document.getElementById('packages').children[0],
              packages,
              list_packages_listener
            );
          }
        },
        (error) =>{
          console.log('pack_list:  ' + error);
        }
    );
  }
}

// fill cache with available nodes
function update_available_nodes_builder (ros)
{
  return function () {
    // get all running nodes on remote host
    nodes = undefined;
    document.getElementById('running_list').children[0].innerHTML = '';
  
    // get all running nodes on remote host
    ros.getNodes((data) => {
        nodes = [];
  
        for (let i = 0; i < data.length; i++)
        {
          nodes.push(
          {
            name: data[i],
            services: undefined
          });
        }
        // manually trigger nodes list view update
        if (data.length >= 1 && data[0] !== '')
        { 
          update_list(
            ros,
            document.getElementById('running_list').children[0],
            nodes,
            list_nodes_listener,
            kill_node_listener
          );
        }
    });
  }
}

// retrive, with service call, all nodes available for the pack
function list_packages_listener (ros, parent, arrow, package)
{
  // check if operation has alrwedy been performed
  if (package.executed || package.nodes !== undefined)
  {
    //toggle_arrow(arrow);
    toggle_visibility(package.name + '_nodes');
  }
  else
  {
    // switch flag to true and perform for the first (and last) time the operation
    package.executed = true;
    // get nodes list for current package
    call_service(ros,
      '/node_list', 'west_tools/NodeList',
      { pack: package.name },
      (result) => {
        package.nodes = [];
        for (let j = 0; j < result.node_list.length; j++) {
          package.nodes.push(result.node_list[j]);
        }
        // trigger list view update
        if (result.node_list.length >= 1 && result.node_list[0] !== '')
          update_sublist(
            package.nodes,
            parent,
            package.name,
            package.name + '_nodes',
            arrow,
            launch_node_builder(ros)
          );
      },
      (error) => {
        show_snackbar(package.name + ' package does NOT contain available node!');
        toggle_arrow(arrow, 'right', 'true');
        console.log('node_list:  ' + error);
      }
    );
  }
}

// retrive, with service call, all services available for the node
function list_nodes_listener (ros, parent, arrow, node)
{
  // check if operation has alrwedy been performed
  if (node.executed || node.services !== undefined)
  {
    //toggle_arrow(arrow);
    toggle_visibility(node.name + '_services');
  }
  else
  {
    // switch flag to true and perform for the first (and last) time the operation
    node.executed = true;
    // get services list from current node
    call_service(ros,
      '/service_list', 'west_tools/ServiceList',
      { node: node.name },
      (result) => {
        node.services = [];
        for (let j = 0; j < result.service_list.length; j++) {
          node.services.push(result.service_list[j]);
        }
        //trigger list view update
        if (result.service_list.length >= 1 && result.service_list[0] !== '')
          update_sublist(
            node.services,
            parent,
            node.name,
            node.name + '_services',
            arrow,
            launch_service_builder(ros)
          );
      },
      (error) => {
        console.log('service_list:  ' + error);
      }
    );
  }
}

// TODO: docstring
function kill_node_listener (ros, parent, node)
{
  // call service
  call_service(
    ros,
    '/kill_node',
    '/west_tools/KillNode',
    { node: node.name },
    (result) => {
      show_snackbar('node killed successfully');
      console.log(result);
    },
    (error) => {
      show_snackbar('node NOT killed!');
      console.log(error);
    }
  );

  // finally, after one second, refresh app page
  refresh_page(1000);
}

// subcrive to rosout topic
function rosout_subscription (ros)
{
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
}

function connect_to_ros (data)
{
  var ros = new ROSLIB.Ros({
    url: 'ws://' + data.address + ':' + data.port
  });
  // store ros variable in cache
  //cache.ros = ros;

  ros.on('error', (error) => {
    console.log('connection error: ', error);
  }); // on error

  ros.on('close', () => {
    console.log('connection closed');
  }); // on close

  ros.on('connection', () => {
    // show controls on connection
    toggle_visibility('app_page', 'block');
    toggle_visibility('controls', 'block');
    toggle_visibility('refresh', 'inline-block');

    cache.ros_call = call_service_builder(ros);

    // get available packages if not already stored in cache
    cache.packages = update_available_packages_builder(ros);
    cache.packages();

    // setup subscription for rosout
    rosout_subscription(ros);

    // get all running nodes on remote host
    cache.nodes = update_available_nodes_builder(ros);
    cache.nodes();
  }); // on connection
}

window.onload = function ()
{
  // setup initial page state
  toggle_visibility('connection', 'block');
  //toggle_visibility('app_page', 'none');
  toggle_visibility('controls', 'none');
  toggle_visibility('running', 'none');
  toggle_visibility('logs', 'none');
  toggle_visibility('packages', 'none');
  toggle_visibility('param_section', 'none');
  toggle_visibility('refresh', 'none');
  toggle_visibility('back_service', 'none');
}
